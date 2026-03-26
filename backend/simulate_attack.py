"""
Имитация сетевых атак для демонстрации на защите.

Генерирует безопасный трафик, имитирующий разные типы атак,
чтобы IDS мог их обнаружить в реальном времени.

Запуск:
    python simulate_attack.py [тип_атаки]

Типы: portscan, ddos, bruteforce, all
"""

import socket
import time
import sys
import threading
import random

TARGET = '127.0.0.1'  # Только localhost — безопасно


def simulate_portscan(duration: int = 15):
    """
    Имитация сканирования портов (PortScan).
    Быстрое подключение к множеству портов — характерный паттерн nmap.
    """
    print("[PortScan] Сканирование портов на localhost...")
    start = time.time()
    scanned = 0

    while time.time() - start < duration:
        port = random.randint(1, 65535)
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.1)
            s.connect_ex((TARGET, port))
            s.close()
            scanned += 1
        except Exception:
            pass
        time.sleep(0.01)  # ~100 портов/сек

    print(f"[PortScan] Просканировано {scanned} портов за {duration}с")


def simulate_ddos(duration: int = 15):
    """
    Имитация DDoS — множество быстрых коротких соединений.
    """
    print("[DDoS] Имитация flood-атаки на localhost:8000...")
    start = time.time()
    count = 0

    while time.time() - start < duration:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.2)
            s.connect((TARGET, 8000))
            s.send(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
            s.close()
            count += 1
        except Exception:
            pass
        time.sleep(0.005)  # ~200 запросов/сек

    print(f"[DDoS] Отправлено {count} запросов за {duration}с")


def simulate_bruteforce(duration: int = 15):
    """
    Имитация brute force — повторные подключения к одному порту
    с отправкой данных (как подбор пароля).
    """
    print("[BruteForce] Имитация подбора пароля на localhost:8000...")
    start = time.time()
    attempts = 0

    while time.time() - start < duration:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            s.connect((TARGET, 8000))
            # Имитация попытки аутентификации
            fake_pass = f"password{random.randint(0, 999999)}"
            payload = f'POST /login HTTP/1.1\r\nHost: localhost\r\nContent-Length: {len(fake_pass)}\r\n\r\n{fake_pass}'
            s.send(payload.encode())
            s.recv(1024)
            s.close()
            attempts += 1
        except Exception:
            pass
        time.sleep(0.05)

    print(f"[BruteForce] {attempts} попыток за {duration}с")


def simulate_normal(duration: int = 15):
    """Нормальный трафик для контраста."""
    print("[Normal] Генерация нормального трафика...")
    start = time.time()
    count = 0

    while time.time() - start < duration:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((TARGET, 8000))
            s.send(b'GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n')
            s.recv(4096)
            s.close()
            count += 1
        except Exception:
            pass
        time.sleep(random.uniform(0.5, 2.0))  # Редкие запросы

    print(f"[Normal] {count} обычных запросов за {duration}с")


def run_demo():
    """
    Полная демонстрация для защиты диплома.

    Сценарий:
    1. Нормальный трафик (10с) — всё зелёное
    2. PortScan (15с) — система обнаруживает
    3. Пауза + нормальный трафик (5с)
    4. DDoS (15с) — система обнаруживает
    5. Пауза + нормальный трафик (5с)
    6. BruteForce (15с) — система обнаруживает
    """
    print("=" * 60)
    print("ДЕМОНСТРАЦИЯ СИСТЕМЫ ОБНАРУЖЕНИЯ АТАК")
    print("=" * 60)
    print("Откройте http://localhost:3000/realtime и нажмите")
    print("'Захват трафика' перед запуском демо.")
    print()
    input("Нажмите Enter когда будете готовы...")

    print("\n--- Фаза 1: Нормальный трафик (10с) ---")
    simulate_normal(10)

    print("\n--- Фаза 2: АТАКА — Сканирование портов (15с) ---")
    simulate_portscan(15)

    print("\n--- Пауза (5с) ---")
    simulate_normal(5)

    print("\n--- Фаза 3: АТАКА — DDoS (15с) ---")
    simulate_ddos(15)

    print("\n--- Пауза (5с) ---")
    simulate_normal(5)

    print("\n--- Фаза 4: АТАКА — Brute Force (15с) ---")
    simulate_bruteforce(15)

    print("\n" + "=" * 60)
    print("ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА")
    print("=" * 60)


def main():
    attack_type = sys.argv[1] if len(sys.argv) > 1 else 'all'

    if attack_type == 'portscan':
        simulate_portscan()
    elif attack_type == 'ddos':
        simulate_ddos()
    elif attack_type == 'bruteforce':
        simulate_bruteforce()
    elif attack_type == 'normal':
        simulate_normal()
    elif attack_type == 'all' or attack_type == 'demo':
        run_demo()
    else:
        print(f"Неизвестный тип: {attack_type}")
        print("Доступные: portscan, ddos, bruteforce, normal, all")


if __name__ == '__main__':
    main()
