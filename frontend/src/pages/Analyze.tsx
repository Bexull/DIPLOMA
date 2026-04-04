import { useState } from 'react';
import {
  Alert,
  Card,
  Typography,
  Row,
  Col,
  Space,
  Tag,
  Table,
  Button,
  Flex,
  Statistic,
  Tabs,
  Input,
  Progress,
  Descriptions,
  List,
} from 'antd';
import {
  UploadOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  FilterOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  GlobalOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import {
  analyzeFile,
  analyzeUrl,
  type AnalysisResponse,
  type Prediction,
  type URLAnalysisResponse,
  type SecurityHeader,
} from '../api';
import { colors, hero, tones } from '../theme';

/* ────────────────────────────────────────────────────────
   CSV Analysis — existing logic wrapped as a component
   ──────────────────────────────────────────────────────── */

function CsvAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const handleFile = async (file: File) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await analyzeFile(file));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось выполнить анализ.');
    } finally {
      setLoading(false);
    }
  };

  const attackTypes = result
    ? [...new Set(result.predictions.filter(p => p.is_attack).map(p => p.attack_type))]
    : [];

  const filtered = result?.predictions.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'attacks') return p.is_attack;
    if (filter === 'normal') return !p.is_attack;
    return p.attack_type === filter;
  }) ?? [];

  const columns = [
    {
      title: '#',
      width: 60,
      render: (_: unknown, __: unknown, i: number) => i + 1,
    },
    {
      title: 'Статус',
      render: (_: unknown, r: Prediction) =>
        r.is_attack ? <Tag color="error">Атака</Tag> : <Tag color="success">Норма</Tag>,
    },
    {
      title: 'Тип атаки',
      dataIndex: 'attack_type',
      render: (v: string, r: Prediction) =>
        r.is_attack ? (
          <Tag color="red">{v}</Tag>
        ) : (
          <Typography.Text type="secondary">BENIGN</Typography.Text>
        ),
    },
    {
      title: 'Anomaly / Порог',
      dataIndex: 'anomaly_score',
      align: 'right' as const,
      render: (v: number, r: Prediction) => {
        const threshold = r.threshold ?? 0;
        const ratio = threshold > 0 ? (v / threshold) : 0;
        return (
          <span title={`Порог: ${threshold.toFixed(4)}`}>
            {v.toFixed(4)}{' '}
            {threshold > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                ({ratio.toFixed(1)}x)
              </Typography.Text>
            )}
          </span>
        );
      },
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      align: 'right' as const,
      render: (v: number, r: Prediction) => (
        <span title={r.confidence_type === 'classifier' ? 'Из классификатора' : 'На основе anomaly score'}>
          {(v * 100).toFixed(1)}%
        </span>
      ),
    },
  ];

  const filterButtons = [
    { key: 'all', label: 'Все' },
    { key: 'attacks', label: 'Атаки' },
    { key: 'normal', label: 'Норма' },
    ...attackTypes.map((type) => ({ key: type, label: type })),
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* File upload */}
      <FileUpload onFile={handleFile} loading={loading} />

      {/* Error banner */}
      {error && <AlertBanner type="error" message={error} />}

      {/* Empty state hints */}
      {!result && !error && (
        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Что важно в файле</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Нужен CSV c признаками сетевого потока. Лучше использовать структуру, близкую к CICIDS2017.
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Что покажет система</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Общий процент атак, тип угрозы, anomaly score и confidence по каждой записи.
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Что делать дальше</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  После загрузки проверьте фильтр по атакам и строки с низкой уверенностью модели.
                </Typography.Paragraph>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Result snapshot header */}
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
              <div>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: colors.primary,
                  }}
                >
                  Result Snapshot
                </Typography.Text>
                <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 4 }}>
                  {result.filename}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ maxWidth: 600, marginBottom: 0 }}>
                  Анализ завершён. Используйте фильтры ниже, чтобы быстро перейти к атакующим
                  потокам или посмотреть конкретный тип угрозы.
                </Typography.Paragraph>
              </div>
              <Tag
                color={result.attacks_found > 0 ? 'error' : 'success'}
                style={{ fontSize: 13, padding: '4px 16px' }}
              >
                {result.attacks_found > 0 ? 'Атаки обнаружены' : 'Трафик выглядит чистым'}
              </Tag>
            </Flex>
          </Card>

          {/* Summary statistics */}
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Всего записей"
                  value={result.total_records}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Атак обнаружено"
                  value={result.attacks_found}
                  prefix={<WarningOutlined />}
                  valueStyle={result.attacks_found > 0 ? { color: colors.danger } : undefined}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Процент атак"
                  value={result.attack_percentage}
                  suffix="%"
                  prefix={<SafetyCertificateOutlined />}
                  valueStyle={result.attack_percentage > 20 ? { color: colors.danger } : undefined}
                />
              </Card>
            </Col>
          </Row>

          {/* Filter + Table */}
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 16 }}>
              <div>
                <Typography.Title level={5} style={{ marginBottom: 4 }}>
                  Фильтрация результатов
                </Typography.Title>
                <Typography.Text type="secondary">
                  Переключайтесь между всеми записями, атаками, нормой и конкретными типами угроз.
                </Typography.Text>
              </div>
              <Space wrap>
                {filterButtons.map(({ key, label }) => (
                  <Button
                    key={key}
                    type={filter === key ? 'primary' : 'default'}
                    onClick={() => setFilter(key)}
                    shape="round"
                    size="small"
                  >
                    {label}
                  </Button>
                ))}
              </Space>
            </Flex>
            <Table
              dataSource={filtered.slice(0, 1000)}
              columns={columns}
              size="middle"
              pagination={{ pageSize: 50 }}
              scroll={{ y: 500 }}
              rowKey={(_: unknown, i?: number) => String(i)}
              rowClassName={(record: Prediction) => (record.is_attack ? 'attack-row' : '')}
              expandable={{
                expandedRowRender: (record: Prediction) => {
                  const features = record.top_features;
                  if (!features || features.length === 0) {
                    return <Typography.Text type="secondary">Нет данных о признаках</Typography.Text>;
                  }
                  return (
                    <div style={{ padding: '8px 0' }}>
                      <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        Ключевые признаки, повлиявшие на решение:
                      </Typography.Text>
                      <Row gutter={[8, 8]}>
                        {features.map((f) => (
                          <Col xs={24} sm={12} md={8} key={f.feature}>
                            <div style={{ padding: '8px 12px', borderRadius: 8, background: f.deviation > 2 ? '#fff2f0' : '#f6ffed', border: `1px solid ${f.deviation > 2 ? '#ffccc7' : '#b7eb8f'}` }}>
                              <Typography.Text strong style={{ fontSize: 12 }}>{f.feature}</Typography.Text>
                              <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>
                                Значение: <strong>{f.value.toFixed(2)}</strong> | Норма: {f.normal_mean.toFixed(2)} | Отклонение: <strong>{f.deviation}x</strong>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  );
                },
                rowExpandable: (record: Prediction) => !!(record.top_features && record.top_features.length > 0),
              }}
            />
            {filtered.length > 1000 && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={`Показано 1 000 из ${filtered.length.toLocaleString()} строк. Статистика рассчитана по всем записям.`}
              />
            )}
          </Card>
        </>
      )}
    </Space>
  );
}

/* ────────────────────────────────────────────────────────
   URL Analysis — new component
   ──────────────────────────────────────────────────────── */

function UrlAnalysis() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<URLAnalysisResponse | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await analyzeUrl(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить анализ URL.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (data: URLAnalysisResponse) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `netshield-report-${data.domain}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const riskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return colors.success;
      case 'medium':
        return colors.warning;
      case 'high':
      case 'critical':
        return colors.danger;
      default:
        return colors.info;
    }
  };

  const riskLabel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'Низкий риск';
      case 'medium':
        return 'Средний риск';
      case 'high':
        return 'Высокий риск';
      case 'critical':
        return 'Критический риск';
      default:
        return level;
    }
  };

  const severityTag = (severity: string, present: boolean) => {
    if (!present) {
      switch (severity.toLowerCase()) {
        case 'high':
        case 'critical':
          return <Tag color="error">Отсутствует</Tag>;
        case 'medium':
          return <Tag color="warning">Отсутствует</Tag>;
        default:
          return <Tag color="default">Отсутствует</Tag>;
      }
    }
    return <Tag color="success">Присутствует</Tag>;
  };

  const headersColumns = [
    {
      title: 'Заголовок',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_: unknown, r: SecurityHeader) => severityTag(r.severity, r.present),
    },
    {
      title: 'Значение',
      dataIndex: 'value',
      key: 'value',
      render: (v: string | null) =>
        v ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {v.length > 80 ? `${v.slice(0, 80)}...` : v}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">--</Typography.Text>
        ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => <Typography.Text type="secondary">{v}</Typography.Text>,
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Input section */}
      <Card>
        <Typography.Title level={5} style={{ marginBottom: 16 }}>
          <GlobalOutlined style={{ marginRight: 8 }} />
          Анализ URL
        </Typography.Title>
        <Flex gap={12}>
          <Input
            size="large"
            placeholder="Вставьте URL сайта для анализа..."
            prefix={<SearchOutlined style={{ color: colors.textMuted }} />}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={handleAnalyze}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            size="large"
            loading={loading}
            onClick={handleAnalyze}
            icon={<SafetyCertificateOutlined />}
          >
            Анализировать
          </Button>
        </Flex>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Примеры: google.com, example.com
        </Typography.Text>
      </Card>

      {/* Error */}
      {error && <AlertBanner type="error" message={error} />}

      {/* Empty state */}
      {!result && !error && (
        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Что проверяется</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  SSL-сертификат, заголовки безопасности, время отклика и основные параметры соединения.
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Разбор оценки</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Система разбивает оценку по категориям: SSL/TLS, заголовки, URL/домен, контент и Threat Intel — 20,000+ индикаторов из OSINT-фидов.
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                style={{ background: colors.bgTile, borderRadius: 16, height: '100%' }}
                bodyStyle={{ padding: 20 }}
              >
                <Typography.Text strong>Отчёт</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Получите оценку безопасности от 0 до 100, рекомендации и возможность скачать JSON-отчёт.
                </Typography.Paragraph>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Score + Export header */}
          <Card>
            <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
              <div>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: colors.primary,
                  }}
                >
                  URL Report
                </Typography.Text>
                <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 4 }}>
                  {result.domain}
                </Typography.Title>
                <Typography.Text type="secondary">{result.url}</Typography.Text>
              </div>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => exportReport(result)}
              >
                Скачать отчёт
              </Button>
            </Flex>
          </Card>

          {/* Security Score + Score Breakdown + Connection */}
          <Row gutter={[24, 24]}>
            {/* Security Score */}
            <Col xs={24} md={8}>
              <Card style={{ textAlign: 'center', height: '100%' }}>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: 16,
                  }}
                >
                  Оценка безопасности
                </Typography.Text>
                <Progress
                  type="circle"
                  percent={result.security_score}
                  size={160}
                  strokeColor={riskColor(result.risk_level)}
                  format={(p) => (
                    <span style={{ fontSize: 32, fontWeight: 700, color: riskColor(result.risk_level) }}>
                      {p}
                    </span>
                  )}
                />
                <div style={{ marginTop: 16 }}>
                  <Tag
                    color={
                      result.risk_level.toLowerCase() === 'low'
                        ? 'success'
                        : result.risk_level.toLowerCase() === 'medium'
                          ? 'warning'
                          : 'error'
                    }
                    style={{ fontSize: 14, padding: '4px 16px' }}
                  >
                    {riskLabel(result.risk_level)}
                  </Tag>
                </div>
              </Card>
            </Col>

            {/* Score Breakdown */}
            <Col xs={24} md={8}>
              <Card style={{ height: '100%' }}>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: 16,
                  }}
                >
                  Разбор оценки
                </Typography.Text>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  {([
                    { label: 'SSL/TLS', value: result.score_breakdown.ssl_tls, max: 20 },
                    { label: 'Заголовки', value: result.score_breakdown.headers, max: 25 },
                    { label: 'URL и домен', value: result.score_breakdown.url_domain, max: 20 },
                    { label: 'Контент', value: result.score_breakdown.content_behavior, max: 15 },
                    { label: 'Threat Intel', value: result.score_breakdown.threat_intel, max: 20 },
                  ] as const).map((item) => {
                    const pct = Math.round((item.value / item.max) * 100);
                    const barColor =
                      pct > 70 ? colors.success : pct > 40 ? colors.warning : colors.danger;
                    return (
                      <div key={item.label}>
                        <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
                          <Typography.Text>{item.label}</Typography.Text>
                          <Typography.Text strong>
                            {item.value} / {item.max}
                          </Typography.Text>
                        </Flex>
                        <Progress
                          percent={pct}
                          showInfo={false}
                          strokeColor={barColor}
                          size="small"
                        />
                      </div>
                    );
                  })}
                </Space>
              </Card>
            </Col>

            {/* Connection Info */}
            <Col xs={24} md={8}>
              <Card style={{ height: '100%' }}>
                <Typography.Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: 16,
                  }}
                >
                  Информация о соединении
                </Typography.Text>
                <Descriptions column={1} size="small" colon={false}>
                  <Descriptions.Item label="IP">{result.connection.ip}</Descriptions.Item>
                  <Descriptions.Item label="Порт">{result.connection.port}</Descriptions.Item>
                  <Descriptions.Item label="Протокол">
                    <Tag color="blue">{result.connection.protocol}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Время отклика">
                    {result.connection.response_time_ms} мс
                  </Descriptions.Item>
                  <Descriptions.Item label="Статус">
                    <Tag
                      color={
                        result.connection.status_code >= 200 &&
                        result.connection.status_code < 300
                          ? 'success'
                          : result.connection.status_code >= 400
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {result.connection.status_code}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="SSL">
                    {result.connection.ssl_valid === null ? (
                      <Tag color="default">Нет данных</Tag>
                    ) : result.connection.ssl_valid ? (
                      <Tag color="success" icon={<LockOutlined />}>
                        Действителен
                      </Tag>
                    ) : (
                      <Tag color="error" icon={<ExclamationCircleOutlined />}>
                        Недействителен
                      </Tag>
                    )}
                  </Descriptions.Item>
                  {result.connection.ssl_issuer && (
                    <Descriptions.Item label="Издатель SSL">
                      <Typography.Text style={{ fontSize: 12 }}>
                        {result.connection.ssl_issuer}
                      </Typography.Text>
                    </Descriptions.Item>
                  )}
                  {result.connection.ssl_expiry && (
                    <Descriptions.Item label="Истекает">
                      {result.connection.ssl_expiry}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Редиректы">
                    {result.connection.redirect_count}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          {/* Threat Intelligence */}
          <Card
            title={
              <Flex align="center" gap={8}>
                <SafetyOutlined />
                Threat Intelligence
              </Flex>
            }
          >
            {result.threat_intel.found ? (
              <Alert
                type="error"
                showIcon
                message="URL найден в базах угроз!"
                description={
                  <Space direction="vertical">
                    {result.threat_intel.matches.map((m, i) => (
                      <div key={i}>
                        <Tag color="error">{m.threat_type}</Tag>
                        <Typography.Text strong>{m.source}</Typography.Text>: {m.details}
                        <br />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Индикатор: {m.indicator}
                        </Typography.Text>
                      </div>
                    ))}
                  </Space>
                }
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="URL не найден в базах угроз"
                description={`Проверено по ${result.threat_intel.feeds_loaded.toLocaleString()} индикаторам из OSINT-фидов (URLhaus, OpenPhish, Phishing.Database, Feodo Tracker) и VirusTotal.`}
              />
            )}

            {/* VirusTotal */}
            {result.threat_intel.virustotal && result.threat_intel.virustotal.available && !result.threat_intel.virustotal.error && (
              <div style={{ marginTop: 16, padding: 20, background: colors.bgTile, borderRadius: 12 }}>
                <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
                  <Typography.Text strong style={{ fontSize: 15 }}>VirusTotal</Typography.Text>
                  <Tag>{result.threat_intel.virustotal.total_engines} движков</Tag>
                </Flex>
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Вредоносных</Typography.Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: result.threat_intel.virustotal.malicious > 0 ? colors.danger : colors.success }}>
                        {result.threat_intel.virustotal.malicious}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Подозрительных</Typography.Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: result.threat_intel.virustotal.suspicious > 0 ? colors.warning : colors.textMuted }}>
                        {result.threat_intel.virustotal.suspicious}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Безопасных</Typography.Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.success }}>
                        {result.threat_intel.virustotal.harmless}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Не определено</Typography.Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.textMuted }}>
                        {result.threat_intel.virustotal.undetected}
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {result.threat_intel.virustotal?.error && (
              <Alert
                type="info"
                showIcon
                message={`VirusTotal: ${result.threat_intel.virustotal.error}`}
                style={{ marginTop: 12 }}
              />
            )}
          </Card>

          {/* Security Headers */}
          <Card>
            <Typography.Title level={5} style={{ marginBottom: 16 }}>
              <LockOutlined style={{ marginRight: 8 }} />
              Заголовки безопасности
            </Typography.Title>
            <Table
              dataSource={result.security_headers}
              columns={headersColumns}
              size="middle"
              pagination={false}
              rowKey="name"
            />
          </Card>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card>
              <Typography.Title level={5} style={{ marginBottom: 16 }}>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                Рекомендации
              </Typography.Title>
              <List
                dataSource={result.recommendations}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Flex gap={8} align="start">
                      <ExclamationCircleOutlined
                        style={{ color: tones.warning.color, marginTop: 4, flexShrink: 0 }}
                      />
                      <Typography.Text>{item}</Typography.Text>
                    </Flex>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </>
      )}
    </Space>
  );
}

/* ────────────────────────────────────────────────────────
   Main Analyze page — Tabs wrapper
   ──────────────────────────────────────────────────────── */

export default function Analyze() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero card with gradient */}
      <Card style={{ background: hero.gradient, border: 'none' }}>
        <Row gutter={24}>
          <Col xs={24} xl={14}>
            <Typography.Text
              style={{
                color: hero.kicker,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              <UploadOutlined style={{ marginRight: 6 }} />
              Offline Traffic Lab
            </Typography.Text>
            <Typography.Title level={3} style={{ color: hero.text, marginTop: 12 }}>
              Загружайте трафик как рабочий артефакт, а не как сырой CSV.
            </Typography.Title>
            <Typography.Paragraph style={{ color: hero.textMuted }}>
              Этот раздел собирает batch-анализ в понятный процесс: принимаем файл, считаем
              долю атак, фильтруем подозрительные записи и показываем confidence по каждому потоку.
            </Typography.Paragraph>
            <Space wrap>
              <Tag
                color={hero.chipBg}
                style={{ border: `1px solid ${hero.chipBorder}`, color: hero.text }}
              >
                <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                CICIDS2017 compatible
              </Tag>
              <Tag
                color={hero.chipBg}
                style={{ border: `1px solid ${hero.chipBorder}`, color: hero.text }}
              >
                <ThunderboltOutlined style={{ marginRight: 4 }} />
                До 10 000 записей на загрузку
              </Tag>
              <Tag
                color={hero.chipBg}
                style={{ border: `1px solid ${hero.chipBorder}`, color: hero.text }}
              >
                <FilterOutlined style={{ marginRight: 4 }} />
                Фильтры по типам атак
              </Tag>
            </Space>
          </Col>
          <Col xs={24} xl={10}>
            <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
              <Card
                style={{
                  background: hero.tileBg,
                  border: 'none',
                  borderRadius: 16,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Flex gap={12} align="start">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: hero.tileBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <UploadOutlined style={{ color: hero.text, fontSize: 18 }} />
                  </div>
                  <div>
                    <Typography.Text strong style={{ color: hero.text, fontSize: 14 }}>
                      1. Загрузка
                    </Typography.Text>
                    <Typography.Paragraph
                      style={{ color: hero.textMuted, fontSize: 13, marginBottom: 0, marginTop: 4 }}
                    >
                      Drag & drop или выбор CSV с сетевыми flow-признаками.
                    </Typography.Paragraph>
                  </div>
                </Flex>
              </Card>
              <Card
                style={{
                  background: hero.tileBg,
                  border: 'none',
                  borderRadius: 16,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Flex gap={12} align="start">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: hero.tileBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SafetyCertificateOutlined style={{ color: hero.text, fontSize: 18 }} />
                  </div>
                  <div>
                    <Typography.Text strong style={{ color: hero.text, fontSize: 14 }}>
                      2. Детекция
                    </Typography.Text>
                    <Typography.Paragraph
                      style={{ color: hero.textMuted, fontSize: 13, marginBottom: 0, marginTop: 4 }}
                    >
                      Автоэнкодер + классификаторы выставляют вердикт и confidence.
                    </Typography.Paragraph>
                  </div>
                </Flex>
              </Card>
              <Card
                style={{
                  background: hero.tileBg,
                  border: 'none',
                  borderRadius: 16,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Flex gap={12} align="start">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: hero.tileBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileTextOutlined style={{ color: hero.text, fontSize: 18 }} />
                  </div>
                  <div>
                    <Typography.Text strong style={{ color: hero.text, fontSize: 14 }}>
                      3. Разбор
                    </Typography.Text>
                    <Typography.Paragraph
                      style={{ color: hero.textMuted, fontSize: 13, marginBottom: 0, marginTop: 4 }}
                    >
                      Получаете таблицу, фильтры и оперативную summary-панель.
                    </Typography.Paragraph>
                  </div>
                </Flex>
              </Card>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs: CSV and URL analysis */}
      <Tabs
        size="large"
        items={[
          {
            key: 'csv',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 6 }} />
                CSV анализ
              </span>
            ),
            children: <CsvAnalysis />,
          },
          {
            key: 'url',
            label: (
              <span>
                <GlobalOutlined style={{ marginRight: 6 }} />
                URL анализ
              </span>
            ),
            children: <UrlAnalysis />,
          },
        ]}
      />
    </Space>
  );
}
