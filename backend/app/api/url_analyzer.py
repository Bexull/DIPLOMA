"""
Многофакторный анализ безопасности URL.

5 категорий оценки (100 баллов):
  1. SSL/TLS              — до 20 баллов
  2. Security Headers     — до 25 баллов
  3. URL и домен          — до 20 баллов
  4. Контент и поведение  — до 15 баллов
  5. Threat Intelligence  — до 20 баллов (OSINT фиды)
"""

import asyncio
import re
import ssl
import socket
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import aiohttp
from pydantic import BaseModel


# ───────────────────── Pydantic-модели ─────────────────────

class URLAnalysisRequest(BaseModel):
    url: str


class SecurityHeader(BaseModel):
    name: str
    present: bool
    value: str | None = None
    severity: str          # "good" | "warning" | "critical"
    description: str


class ConnectionInfo(BaseModel):
    ip: str
    port: int
    protocol: str
    response_time_ms: float
    status_code: int
    content_length: int
    redirect_count: int = 0
    ssl_valid: bool | None = None
    ssl_issuer: str | None = None
    ssl_expiry: str | None = None


class VTInfo(BaseModel):
    available: bool = False
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0
    total_engines: int = 0
    reputation: int = 0
    error: str | None = None


class ThreatIntelResult(BaseModel):
    found: bool
    matches: list[dict] = []
    feeds_loaded: int = 0
    virustotal: VTInfo | None = None


class ScoreBreakdown(BaseModel):
    ssl_tls: int              # /20
    headers: int              # /25
    url_domain: int           # /20
    content_behavior: int     # /15
    threat_intel: int         # /20


class URLAnalysisResponse(BaseModel):
    url: str
    domain: str
    connection: ConnectionInfo
    security_headers: list[SecurityHeader]
    security_score: int          # 0-100
    score_breakdown: ScoreBreakdown
    threat_intel: ThreatIntelResult
    risk_level: str              # "safe" | "low" | "medium" | "high"
    recommendations: list[str]
    timestamp: str


# ───────────── Подозрительные TLD / паттерны ───────────────

TRUSTED_TLDS = {
    "com", "org", "net", "edu", "gov", "mil",
    "io", "co", "me", "app", "dev", "ai",
    "ru", "uk", "de", "fr", "jp", "kr", "cn", "in", "br",
    "ua", "kz", "by", "us", "ca", "au", "nl", "it", "es",
    "info", "biz",
}

SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq",     # бесплатные — часто для фишинга
    "xyz", "top", "club", "work",      # дешёвые — популярны у спамеров
    "buzz", "surf", "icu", "monster",
}

SUSPICIOUS_URL_PATTERNS = [
    re.compile(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"),  # IP вместо домена
    re.compile(r"[%]{2,}"),                                # double-encoded
    re.compile(r"@"),                                      # user@host trick
    re.compile(r"-{3,}"),                                  # слишком много дефисов
    re.compile(r"(login|signin|verify|secure|account|update|confirm)"
               r".*\.(tk|ml|ga|cf|gq|xyz)", re.I),        # фишинг-комбо
]


# ───────────── 1. SSL / TLS  (макс 25) ────────────────────

def _score_ssl(
    is_https: bool,
    ssl_valid: bool | None,
    ssl_expiry: str | None,
) -> tuple[int, list[str]]:
    score = 0
    recs: list[str] = []

    if not is_https:
        recs.append(
            "Критично: сайт доступен только по HTTP. "
            "Необходимо подключить HTTPS с валидным сертификатом."
        )
        return 0, recs

    score += 12  # HTTPS есть

    if ssl_valid is True:
        score += 4
    elif ssl_valid is False:
        recs.append(
            "SSL-сертификат недействителен. "
            "Замените на валидный (Let's Encrypt, Cloudflare и др.)."
        )

    # Проверка срока действия
    if ssl_expiry:
        try:
            from email.utils import parsedate_to_datetime
            exp = parsedate_to_datetime(ssl_expiry)
            days_left = (exp - datetime.now(timezone.utc)).days
            if days_left > 30:
                score += 4
            elif days_left > 0:
                score += 2
                recs.append(
                    f"SSL-сертификат истекает через {days_left} дн. "
                    "Рекомендуется обновить заранее."
                )
            else:
                recs.append("SSL-сертификат просрочен!")
        except Exception:
            score += 3  # не смогли распарсить — даём частичный балл

    return min(score, 20), recs


# ───────────── 2. Security Headers  (макс 30) ─────────────

# (header_name, max_points, is_critical)
HEADER_WEIGHTS = [
    ("Strict-Transport-Security", 5, True),
    ("Content-Security-Policy",   4, False),
    ("X-Content-Type-Options",    3, False),
    ("X-Frame-Options",           3, False),
    ("Referrer-Policy",           3, False),
    ("Permissions-Policy",        3, False),
    ("X-XSS-Protection",          2, False),
    # Server / X-Powered-By — штрафы, см. ниже  (сумма: 23 + возможные штрафы)
]

HEADER_DESCRIPTIONS = {
    "Strict-Transport-Security":
        "HSTS заставляет браузер использовать только HTTPS.",
    "Content-Security-Policy":
        "CSP защищает от XSS и инъекций контента.",
    "X-Content-Type-Options":
        "Предотвращает MIME-sniffing.",
    "X-Frame-Options":
        "Защита от clickjacking (вставка во фрейм).",
    "Referrer-Policy":
        "Контролирует, какие данные уходят в заголовке Referer.",
    "Permissions-Policy":
        "Ограничивает доступ к API браузера (камера, геолокация).",
    "X-XSS-Protection":
        "Встроенный фильтр XSS (устаревший, но полезный как запас).",
}


def _score_headers(
    raw_headers: dict,
    is_https: bool,
) -> tuple[int, list[SecurityHeader], list[str]]:
    score = 0
    results: list[SecurityHeader] = []
    recs: list[str] = []

    for name, points, critical in HEADER_WEIGHTS:
        value = raw_headers.get(name)
        if value:
            score += points
            results.append(SecurityHeader(
                name=name, present=True,
                value=value if len(value) <= 200 else value[:200] + "…",
                severity="good",
                description=HEADER_DESCRIPTIONS[name],
            ))
        else:
            sev = "critical" if critical and is_https else "warning"
            results.append(SecurityHeader(
                name=name, present=False, severity=sev,
                description=HEADER_DESCRIPTIONS[name],
            ))
            recs.append(f"Добавьте заголовок {name} — {HEADER_DESCRIPTIONS[name]}")

    # Штраф за утечку Server-версии
    server = raw_headers.get("Server", "")
    has_version = bool(re.search(r"\d", server))
    if server and has_version:
        score -= 2
        results.append(SecurityHeader(
            name="Server", present=True, value=server,
            severity="warning",
            description=f"Раскрывает версию ПО: {server}.",
        ))
        recs.append(f"Скройте версию в заголовке Server ({server}).")
    elif server:
        results.append(SecurityHeader(
            name="Server", present=True, value=server,
            severity="good",
            description="Присутствует, но без версии.",
        ))
    else:
        results.append(SecurityHeader(
            name="Server", present=False, severity="good",
            description="Скрыт — информация о сервере не раскрывается.",
        ))

    # Штраф за X-Powered-By
    xpb = raw_headers.get("X-Powered-By")
    if xpb:
        score -= 3
        results.append(SecurityHeader(
            name="X-Powered-By", present=True, value=xpb,
            severity="warning",
            description=f"Раскрывает технологию: {xpb}.",
        ))
        recs.append(f"Удалите заголовок X-Powered-By ({xpb}).")
    else:
        results.append(SecurityHeader(
            name="X-Powered-By", present=False, severity="good",
            description="Технологии сервера не раскрываются.",
        ))

    return max(score, 0), results, recs


# ───────────── 3. URL и домен  (макс 25) ──────────────────

def _score_url_domain(url: str, domain: str) -> tuple[int, list[str]]:
    score = 0
    recs: list[str] = []

    # Нормальный TLD
    tld = domain.rsplit(".", 1)[-1].lower() if "." in domain else ""
    if tld in TRUSTED_TLDS:
        score += 5
    elif tld in SUSPICIOUS_TLDS:
        score += 1
        recs.append(
            f"Домен использует TLD .{tld}, который часто ассоциируется "
            "с фишингом и спамом."
        )
    else:
        score += 4

    # Не IP-адрес
    is_ip = bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain))
    if is_ip:
        recs.append("Вместо домена используется IP-адрес — подозрительно.")
    else:
        score += 4

    # Длина домена (короткий = лучше)
    if len(domain) <= 20:
        score += 4
    elif len(domain) <= 40:
        score += 2
    else:
        score += 1
        recs.append(f"Необычно длинный домен ({len(domain)} символов).")

    # Количество поддоменов
    subdomain_count = domain.count(".") - 1
    if subdomain_count <= 1:
        score += 3
    elif subdomain_count <= 3:
        score += 1
    else:
        recs.append(f"Слишком много поддоменов ({subdomain_count + 1}) — может быть признаком фишинга.")

    # Подозрительные паттерны в URL
    suspicious_hits = sum(1 for p in SUSPICIOUS_URL_PATTERNS if p.search(url))
    if suspicious_hits == 0:
        score += 4
    else:
        score -= suspicious_hits * 2
        recs.append("В URL обнаружены подозрительные паттерны.")

    return max(min(score, 20), 0), recs


# ───────────── 4. Контент и поведение  (макс 20) ──────────

def _score_content_behavior(
    status_code: int,
    response_time_ms: float,
    content_length: int,
    redirect_count: int,
    content_type: str,
) -> tuple[int, list[str]]:
    score = 0
    recs: list[str] = []

    # Статус-код
    if 200 <= status_code < 300:
        score += 4
    elif 300 <= status_code < 400:
        score += 2
    elif status_code == 403:
        score += 1
    else:
        recs.append(f"Сервер вернул код {status_code}.")

    # Время ответа
    if response_time_ms < 1000:
        score += 4
    elif response_time_ms < 3000:
        score += 2
    else:
        score += 1
        recs.append(
            f"Высокое время ответа ({response_time_ms:.0f} мс) — "
            "может указывать на проблемы с инфраструктурой."
        )

    # Content-Type
    if content_type and ("text/html" in content_type or "application/json" in content_type):
        score += 4
    elif content_type:
        score += 2
    else:
        score += 1
        recs.append("Сервер не указал Content-Type.")

    # Редиректы
    if redirect_count <= 2:
        score += 3
    elif redirect_count <= 4:
        score += 1
        recs.append(f"Цепочка из {redirect_count} редиректов — проверьте, куда ведёт.")
    else:
        recs.append(f"Слишком много редиректов ({redirect_count}) — подозрительно.")

    return min(score, 15), recs


# ───────────── SSL-проверка ────────────────────────────────

async def _get_ssl_info(hostname: str, port: int = 443) -> dict:
    try:
        ctx = ssl.create_default_context()
        loop = asyncio.get_event_loop()

        def _fetch():
            with socket.create_connection((hostname, port), timeout=5) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    return ssock.getpeercert()

        cert = await loop.run_in_executor(None, _fetch)

        issuer_parts = []
        for rdn in cert.get("issuer", ()):
            for attr_type, attr_value in rdn:
                if attr_type in ("organizationName", "commonName"):
                    issuer_parts.append(attr_value)

        return {
            "ssl_valid": True,
            "ssl_issuer": ", ".join(issuer_parts) or "Неизвестен",
            "ssl_expiry": cert.get("notAfter", ""),
        }
    except ssl.SSLCertVerificationError:
        return {"ssl_valid": False, "ssl_issuer": None, "ssl_expiry": None}
    except Exception:
        return {"ssl_valid": None, "ssl_issuer": None, "ssl_expiry": None}


# ───────────── Уровень риска ───────────────────────────────

def _risk_level(score: int) -> str:
    if score >= 80:
        return "safe"
    if score >= 60:
        return "low"
    if score >= 40:
        return "medium"
    return "high"


# ───────────── Нормализация URL ────────────────────────────

def _normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


# ═══════════════════ ГЛАВНАЯ ФУНКЦИЯ ═══════════════════════

async def analyze_url(url: str, pipeline=None) -> URLAnalysisResponse:
    """
    Комплексный 5-факторный анализ безопасности URL.

    1. SSL/TLS              (до 20)
    2. Security Headers     (до 25)
    3. URL и домен          (до 20)
    4. Контент и поведение  (до 15)
    5. Threat Intelligence  (до 20)
    ──────────────────────────────
    Итого                   100
    """
    from app.api.threat_feeds import check_url, check_ip, get_feed_stats, check_virustotal

    url = _normalize_url(url)
    parsed = urlparse(url)
    domain = parsed.hostname or ""
    is_https = parsed.scheme == "https"
    port = parsed.port or (443 if is_https else 80)

    # ── HTTP-запрос ──
    timeout = aiohttp.ClientTimeout(total=8)
    start = time.monotonic()
    redirect_count = 0
    content_type = ""

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url, allow_redirects=True, ssl=False,
                max_redirects=10,
            ) as resp:
                elapsed_ms = (time.monotonic() - start) * 1000.0
                status_code = resp.status
                raw_headers = {k: v for k, v in resp.headers.items()}
                content_type = raw_headers.get("Content-Type", "")
                body = await resp.read()
                content_length = len(body)
                redirect_count = len(resp.history)
    except asyncio.TimeoutError:
        raise RuntimeError(f"Таймаут при подключении к {domain} (8 секунд)")
    except aiohttp.ClientConnectorError as exc:
        raise RuntimeError(f"Не удалось подключиться к {domain}: {exc}")
    except aiohttp.ClientError as exc:
        raise RuntimeError(f"Ошибка HTTP-запроса: {exc}")

    # ── DNS ──
    try:
        loop = asyncio.get_event_loop()
        ip = await loop.run_in_executor(None, lambda: socket.gethostbyname(domain))
    except socket.gaierror:
        ip = "0.0.0.0"

    # ── SSL ──
    ssl_info: dict = {"ssl_valid": None, "ssl_issuer": None, "ssl_expiry": None}
    if is_https:
        ssl_info = await _get_ssl_info(domain, port)

    connection = ConnectionInfo(
        ip=ip, port=port,
        protocol=parsed.scheme.upper(),
        response_time_ms=round(elapsed_ms, 2),
        status_code=status_code,
        content_length=content_length,
        redirect_count=redirect_count,
        **ssl_info,
    )

    # ═══ 5-ФАКТОРНЫЙ СКОРИНГ ═══

    all_recs: list[str] = []

    # 1. SSL/TLS (до 20)
    ssl_score, ssl_recs = _score_ssl(is_https, ssl_info.get("ssl_valid"), ssl_info.get("ssl_expiry"))
    all_recs.extend(ssl_recs)

    # 2. Security Headers (до 25)
    hdr_score, sec_headers, hdr_recs = _score_headers(raw_headers, is_https)
    all_recs.extend(hdr_recs)

    # 3. URL и домен (до 20)
    url_score, url_recs = _score_url_domain(url, domain)
    all_recs.extend(url_recs)

    # 4. Контент и поведение (до 15)
    cb_score, cb_recs = _score_content_behavior(
        status_code, elapsed_ms, content_length, redirect_count, content_type,
    )
    all_recs.extend(cb_recs)

    # 5. Threat Intelligence (до 20)
    ti_score = 20
    url_threats = await check_url(url)
    ip_threats = await check_ip(ip)
    all_threats = url_threats + ip_threats
    feed_stats = get_feed_stats()

    # VirusTotal
    vt_result = await check_virustotal(url)
    vt_info = VTInfo(
        available=vt_result.available,
        malicious=vt_result.malicious,
        suspicious=vt_result.suspicious,
        harmless=vt_result.harmless,
        undetected=vt_result.undetected,
        total_engines=vt_result.total_engines,
        reputation=vt_result.reputation,
        error=vt_result.error,
    )

    ti_matches = []

    # OSINT фиды
    if all_threats:
        ti_score = 0
        for t in all_threats:
            ti_matches.append({
                "source": t.source,
                "indicator": t.indicator,
                "threat_type": t.threat_type,
                "details": t.details,
            })
            all_recs.insert(0,
                f"⚠ THREAT INTELLIGENCE: {t.details} (источник: {t.source})"
            )

    # VirusTotal scoring
    if vt_result.available and not vt_result.error:
        if vt_result.malicious > 0:
            # Число движков, считающих вредоносным — сильный сигнал
            if vt_result.malicious >= 5:
                ti_score = 0
                all_recs.insert(0,
                    f"⚠ VirusTotal: {vt_result.malicious} из {vt_result.total_engines} "
                    "антивирусных движков считают URL вредоносным!"
                )
            else:
                ti_score = min(ti_score, 8)
                all_recs.insert(0,
                    f"⚠ VirusTotal: {vt_result.malicious} из {vt_result.total_engines} "
                    "движков пометили URL как подозрительный."
                )
        if vt_result.suspicious > 0 and ti_score > 10:
            ti_score = min(ti_score, 12)

    found = len(all_threats) > 0 or (vt_result.available and vt_result.malicious > 0)

    threat_intel = ThreatIntelResult(
        found=found,
        matches=ti_matches,
        feeds_loaded=feed_stats.get("malicious_urls", 0) + feed_stats.get("malicious_ips", 0),
        virustotal=vt_info,
    )

    total_score = ssl_score + hdr_score + url_score + cb_score + ti_score
    total_score = max(0, min(100, total_score))

    if not all_recs:
        all_recs.append("Серьёзных проблем не обнаружено. Сайт выглядит безопасным.")

    return URLAnalysisResponse(
        url=url,
        domain=domain,
        connection=connection,
        security_headers=sec_headers,
        security_score=total_score,
        score_breakdown=ScoreBreakdown(
            ssl_tls=ssl_score,
            headers=hdr_score,
            url_domain=url_score,
            content_behavior=cb_score,
            threat_intel=ti_score,
        ),
        threat_intel=threat_intel,
        risk_level=_risk_level(total_score),
        recommendations=all_recs,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
