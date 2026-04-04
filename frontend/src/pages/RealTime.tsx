import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bomb,
  Brain,
  Bug,
  KeyRound,
  Radar,
  Search,
  Shield,
  Shuffle,
  Square,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWebSocket, type RealtimeRecord } from '../hooks/useWebSocket';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Tag,
  Button,
  Table,
  Flex,
  Progress,
  Collapse,
  Statistic,
  Divider,
} from 'antd';
import { colors, hero, chart } from '../theme';

/* -- Scenarios ---------------------------------------- */

const ATTACKS = [
  { id: 'ddos',        icon: Bomb,     label: 'DDoS',           sub: 'Отказ в обслуживании',   color: colors.danger },
  { id: 'portscan',    icon: Search,   label: 'Port Scan',      sub: 'Разведка сети',          color: colors.warning },
  { id: 'bruteforce',  icon: KeyRound, label: 'Brute Force',    sub: 'Подбор паролей',         color: '#D97706' },
  { id: 'web_attack',  icon: Bug,      label: 'Web Attack',     sub: 'SQL Injection / XSS',    color: '#6366F1' },
  { id: 'mixed',       icon: Shuffle,  label: 'Смешанная',      sub: 'Все типы атак',          color: '#DB2777' },
];

const ATTACK_INFO: Record<string, { danger: string; traffic: string; model: string }> = {
  'DDoS': {
    danger: 'Сервер перегружается тысячами запросов. Легитимные пользователи теряют доступ к сервису.',
    traffic: 'Множество коротких TCP-соединений с частотой >1000 пакетов/сек, минимальный размер, десятки уникальных IP.',
    model: 'Автоэнкодер: ошибка реконструкции в 8x выше порога. XGBoost подтвердил тип с уверенностью >99%.',
  },
  'PortScan': {
    danger: 'Злоумышленник перебирает порты сервера, ищет открытые сервисы для последующей атаки.',
    traffic: 'Один IP -> сотни портов, SYN-пакеты с интервалом <100мс, 1-2 пакета на соединение.',
    model: 'Ключевые признаки: Flow Duration = 0, Fwd Packets = 1, SYN Flag Count = 1. Anomaly score 5x выше порога.',
  },
  'Brute Force': {
    danger: 'Автоматический подбор пароля к SSH/RDP/FTP. При успехе -- полный доступ к серверу.',
    traffic: 'Повторяющиеся подключения к порту 22/3389 с одного IP, стабильный размер пакетов.',
    model: 'Признаки: dst_port = const, высокая частота повторных соединений, Fwd Packet Length = const.',
  },
  'Web Attack': {
    danger: 'Внедрение SQL-кода или XSS через веб-формы. Цель -- кража данных из базы.',
    traffic: 'HTTP-запросы с аномально большим payload, нетипичные паттерны к портам 80/443.',
    model: 'Автоэнкодер: аномалия в Fwd Packet Length Mean и Packet Length Variance.',
  },
  'Bot': {
    danger: 'Заражённый хост управляется извне (C&C). Может красть данные или участвовать в DDoS.',
    traffic: 'Периодические исходящие соединения к подозрительным IP с фиксированным интервалом.',
    model: 'Признаки: регулярные Active/Idle Mean, фиксированный размер пакетов, нетипичные порты.',
  },
  'Infiltration': {
    danger: 'Скрытое проникновение -- злоумышленник внутри сети, собирает данные.',
    traffic: 'Длительные соединения, постепенное увеличение объёма, внутренний трафик.',
    model: 'Автоэнкодер поймал аномалию по совокупности: Flow Duration, Init_Win_bytes, Down/Up Ratio.',
  },
  'Unknown Attack': {
    danger: 'Неизвестная аномалия — трафик отклоняется от нормального профиля.',
    traffic: 'Трафик не похож на нормальный и не совпадает с известными паттернами атак.',
    model: 'Автоэнкодер обнаружил аномалию, но классификатор не смог определить тип -- это преимущество двухуровневой архитектуры.',
  },
};

const metricTileStyle: React.CSSProperties = {
  background: hero.tileBg,
  borderRadius: 12,
  padding: 20,
  border: `1px solid ${hero.tileBorder}`,
};

/* -- Main Component ----------------------------------- */

export default function RealTime() {
  const {
    connected, records, status, running, scenario, completed,
    connect, runScenario, stop,
  } = useWebSocket();
  const [, setTableOpen] = useState(false);

  useEffect(() => {
    if (!connected) connect();
  }, [connect, connected]);

  const totalAttacks = records.filter(r => r.is_attack).length;
  const totalSafe = records.length - totalAttacks;
  const threatPct = records.length > 0 ? Math.round((totalAttacks / records.length) * 100) : 0;

  const attackCounts: Record<string, number> = {};
  records.forEach(r => {
    if (r.is_attack) attackCounts[r.attack_type] = (attackCounts[r.attack_type] || 0) + 1;
  });

  const pieData: { name: string; value: number }[] = [];
  if (totalSafe > 0) pieData.push({ name: 'Безопасный', value: totalSafe });
  Object.entries(attackCounts).forEach(([name, value]) => pieData.push({ name, value }));

  const timelineData: { bucket: string; attacks: number; safe: number }[] = [];
  const ascendingRecords = [...records].reverse();
  for (let i = 0; i < ascendingRecords.length; i += 10) {
    const batch = ascendingRecords.slice(i, i + 10);
    const attacks = batch.filter(r => r.is_attack).length;
    timelineData.push({
      bucket: `${Math.floor(i / 10) + 1}`,
      attacks,
      safe: batch.length - attacks,
    });
  }

  const topAttack = Object.keys(attackCounts).sort((a, b) => attackCounts[b] - attackCounts[a])[0] ?? null;

  const showPicker = !running && records.length === 0;
  const showResults = records.length > 0;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero */}
      <Card style={{ background: hero.gradient, border: 'none' }}>
        <Row gutter={24} align="bottom">
          <Col xs={24} xl={14}>
            <Typography.Text strong style={{ color: hero.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
              <Radar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Live Detection
            </Typography.Text>
            <Typography.Title level={2} style={{ color: hero.text, margin: '16px 0 0' }}>
              Мониторинг соединений и воспроизведение сценариев атак
            </Typography.Title>
            <Typography.Paragraph style={{ color: hero.textMuted, marginTop: 16, marginBottom: 0 }}>
              Запускайте сценарии атак (воспроизведение заранее записанных данных CICIDS2017) или просматривайте системные соединения вашей машины. Оценка угроз основана на статистическом профиле — это не полноценный DPI (Deep Packet Inspection).
            </Typography.Paragraph>
            <Space style={{ marginTop: 16 }} wrap>
              <Tag
                color={connected ? 'success' : 'error'}
                icon={connected ? <Wifi size={15} style={{ verticalAlign: 'middle' }} /> : <WifiOff size={15} style={{ verticalAlign: 'middle' }} />}
              >
                {connected ? 'WebSocket подключен' : 'Нет соединения'}
              </Tag>
              {scenario && (
                <Tag color="purple" icon={<Activity size={15} style={{ verticalAlign: 'middle' }} />}>
                  {scenario.title}
                </Tag>
              )}
              <Tag color="default" icon={<Shield size={15} style={{ verticalAlign: 'middle' }} />}>
                {running ? 'Сценарий активен' : completed ? 'Последний сценарий завершён' : 'Ожидает запуск'}
              </Tag>
            </Space>
          </Col>
          <Col xs={24} xl={10}>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={8}>
                <div style={metricTileStyle}>
                  <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Статус</Typography.Text>
                  <div style={{ marginTop: 12, fontSize: 22, fontWeight: 600, color: connected ? '#86efac' : '#fca5a5' }}>{connected ? 'Online' : 'Offline'}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: hero.textMuted }}>{status}</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={metricTileStyle}>
                  <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Потоков</Typography.Text>
                  <div style={{ marginTop: 12, fontSize: 22, fontWeight: 600, color: hero.text }}>{records.length}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: hero.textMuted }}>Текущий размер live-буфера</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={metricTileStyle}>
                  <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Риск</Typography.Text>
                  <div style={{ marginTop: 12, fontSize: 22, fontWeight: 600, color: threatPct > 20 ? '#fca5a5' : '#86efac' }}>{threatPct}%</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: hero.textMuted }}>Доля атак в текущем потоке</div>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Stop button */}
      {running && (
        <Button danger icon={<Square size={14} />} onClick={stop}>
          Остановить сценарий
        </Button>
      )}

      {/* Scenario picker */}
      {(showPicker || (completed && !running)) && (
        <>
          {completed && (
            <Card size="small">
              <Flex align="center" gap={12}>
                <Shield size={16} style={{ color: colors.success }} />
                <Typography.Text type="secondary">{completed.title} — завершено</Typography.Text>
              </Flex>
            </Card>
          )}

          <Row gutter={24}>
            <Col xs={24} xl={10}>
              <Card
                hoverable
                onClick={() => { if (connected) { setTableOpen(false); runScenario('live'); } }}
                style={{ height: '100%', cursor: connected ? 'pointer' : 'not-allowed', opacity: connected ? 1 : 0.4 }}
              >
                <Flex vertical style={{ height: '100%' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Radar size={24} style={{ color: colors.primary }} />
                  </div>
                  <Typography.Title level={4} style={{ marginTop: 20 }}>Мой трафик</Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ flex: 1 }}>
                    Мониторинг системных соединений. Оценка угроз на основе статистического профиля — не является полноценным DPI (Deep Packet Inspection).
                  </Typography.Paragraph>
                  <Flex justify="space-between" align="center" style={{ marginTop: 24 }}>
                    <Tag>Мониторинг соединений</Tag>
                    <Wifi size={20} style={{ color: colors.textMuted }} />
                  </Flex>
                </Flex>
              </Card>
            </Col>
            <Col xs={24} xl={14}>
              <Card title="Сценарии атаки" extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>Воспроизведение записанных данных CICIDS2017</Typography.Text>}>
                <Row gutter={[16, 16]}>
                  {ATTACKS.map((attack) => {
                    const Icon = attack.icon;
                    return (
                      <Col span={8} key={attack.id}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => { if (connected) { setTableOpen(false); runScenario(attack.id); } }}
                          style={{ textAlign: 'left', cursor: connected ? 'pointer' : 'not-allowed', opacity: connected ? 1 : 0.4 }}
                        >
                          <Icon size={20} style={{ color: attack.color }} />
                          <Typography.Title level={5} style={{ marginTop: 12 }}>{attack.label}</Typography.Title>
                          <Typography.Text type="secondary">{attack.sub}</Typography.Text>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Results */}
      {showResults && (
        <>
          {/* ThreatBar */}
          <ThreatBar pct={threatPct} total={records.length} attacks={totalAttacks} safe={totalSafe} running={running} />

          {/* Pie chart + Attack detail */}
          <Row gutter={24}>
            <Col xs={24} xl={10}>
              <Card title="Состав трафика" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Как текущий поток делится между нормой и атаками</Typography.Text>}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={chart.pie[index % chart.pie.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chart.tooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <Flex justify="center" wrap="wrap" gap={16} style={{ marginTop: 8 }}>
                  {pieData.map((entry, index) => (
                    <Flex key={entry.name} align="center" gap={6}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chart.pie[index % chart.pie.length] }} />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{entry.name}: {entry.value}</Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              </Card>
            </Col>
            <Col xs={24} xl={14}>
              {topAttack ? (
                <AttackDetail type={topAttack} count={attackCounts[topAttack]} allCounts={attackCounts} />
              ) : (
                <SafePanel total={records.length} />
              )}
            </Col>
          </Row>

          {/* Timeline */}
          {timelineData.length > 1 && (
            <Card title="Динамика обнаружения" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Каждая точка показывает пакет из 10 последних потоков</Typography.Text>}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="bucket" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chart.tooltip} />
                  <Area type="monotone" dataKey="safe" stackId="1" stroke={chart.safe} fill={chart.safe} fillOpacity={0.15} name="Норма" />
                  <Area type="monotone" dataKey="attacks" stackId="1" stroke={chart.attack} fill={chart.attack} fillOpacity={0.2} name="Атаки" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Model panel */}
          <ModelPanel records={records} />

          {/* Flow details */}
          <Collapse
            items={[{
              key: '1',
              label: `Детали потоков (${records.length})`,
              children: (
                <Table
                  dataSource={records.slice(0, 200)}
                  rowKey={(record, index) => `${record.index}-${index}`}
                  size="small"
                  pagination={false}
                  scroll={{ y: 340 }}
                  columns={flowColumns}
                />
              ),
            }]}
          />
        </>
      )}
    </Space>
  );
}

/* -- Flow Table Columns ------------------------------- */

const flowColumns = [
  {
    title: 'Время',
    key: 'time',
    render: (_: unknown, r: RealtimeRecord) => new Date(r.timestamp).toLocaleTimeString('ru-RU'),
  },
  {
    title: 'Источник',
    key: 'src',
    render: (_: unknown, r: RealtimeRecord) => `${r.src_ip}:${r.src_port}`,
  },
  {
    title: 'Назначение',
    key: 'dst',
    render: (_: unknown, r: RealtimeRecord) => (
      <>
        {r.dst_ip}:{r.dst_port}
        {r.dst_label && <Typography.Text style={{ marginLeft: 4, color: colors.primary }}>({r.dst_label})</Typography.Text>}
      </>
    ),
  },
  {
    title: 'Вердикт',
    key: 'verdict',
    align: 'center' as const,
    render: (_: unknown, r: RealtimeRecord) =>
      r.is_attack ? <Tag color="error">АТАКА</Tag> : <Tag color="success">OK</Tag>,
  },
  {
    title: 'Тип',
    key: 'type',
    render: (_: unknown, r: RealtimeRecord) =>
      r.is_attack ? <Typography.Text style={{ color: colors.danger }}>{r.attack_type}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
  },
  {
    title: 'Score',
    dataIndex: 'anomaly_score',
    key: 'score',
    align: 'right' as const,
    render: (v: number) => v.toFixed(4),
  },
];

/* -- ThreatBar ---------------------------------------- */

function ThreatBar({ pct, total, attacks, safe, running }: {
  pct: number; total: number; attacks: number; safe: number; running: boolean;
}) {
  const level = pct === 0 ? 'safe' : pct < 20 ? 'low' : pct < 50 ? 'med' : 'high';
  const cfg = {
    safe: { color: colors.success, label: 'Безопасно' },
    low:  { color: colors.warning, label: 'Низкая угроза' },
    med:  { color: '#EA580C',      label: 'Средняя угроза' },
    high: { color: colors.danger,  label: 'Высокая угроза' },
  }[level];

  return (
    <Card>
      <Flex align="center" gap={24} wrap="wrap">
        <Progress type="circle" percent={pct} size={80} strokeColor={cfg.color} />
        <div>
          <Typography.Title level={4} style={{ color: cfg.color, margin: 0 }}>{cfg.label}</Typography.Title>
          <Typography.Text type="secondary">{total} потоков в текущем окне анализа</Typography.Text>
          {running && (
            <div style={{ marginTop: 8 }}>
              <Tag color="purple">Мониторинг активен</Tag>
            </div>
          )}
        </div>
        <Row gutter={16} style={{ flex: 1 }}>
          <Col span={12}>
            <Card size="small" style={{ background: colors.successBg }}>
              <Statistic title="Безопасные" value={safe} valueStyle={{ color: colors.success }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ background: colors.dangerBg }}>
              <Statistic title="Атаки" value={attacks} valueStyle={{ color: colors.danger }} />
            </Card>
          </Col>
        </Row>
      </Flex>
    </Card>
  );
}

/* -- Safe Panel --------------------------------------- */

function SafePanel({ total }: { total: number }) {
  return (
    <Card style={{ height: '100%' }}>
      <Flex vertical align="center" justify="center" style={{ height: '100%', padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={24} style={{ color: colors.success }} />
        </div>
        <Typography.Title level={4} style={{ color: colors.success, marginTop: 16 }}>Угроз не обнаружено</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', maxWidth: 380 }}>
          Автоэнкодер проверил {total} потоков и не увидел существенного превышения порога reconstruction error.
        </Typography.Paragraph>
      </Flex>
    </Card>
  );
}

/* -- Attack Detail ------------------------------------ */

function AttackDetail({ type, count, allCounts }: {
  type: string; count: number; allCounts: Record<string, number>;
}) {
  const info = ATTACK_INFO[type] || ATTACK_INFO['Unknown Attack'];

  return (
    <Card style={{ height: '100%' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={8}>
            <AlertTriangle size={16} style={{ color: colors.danger }} />
            <Typography.Text strong style={{ color: colors.danger }}>Обнаружена атака: {type}</Typography.Text>
          </Flex>
          <Tag color="error">{count}</Tag>
        </Flex>

        <div>
          <Typography.Text strong style={{ color: colors.danger, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Опасность</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>{info.danger}</Typography.Paragraph>
        </div>
        <div>
          <Typography.Text strong style={{ color: colors.warning, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Паттерн в трафике</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>{info.traffic}</Typography.Paragraph>
        </div>
        <div>
          <Typography.Text strong style={{ color: colors.info, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Как обнаружено</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>{info.model}</Typography.Paragraph>
        </div>

        {Object.keys(allCounts).length > 1 && (
          <>
            <Divider style={{ margin: 0 }} />
            <Flex wrap="wrap" gap={8}>
              {Object.entries(allCounts).map(([attackType, value]) => (
                <Tag key={attackType}>{attackType}: {value}</Tag>
              ))}
            </Flex>
          </>
        )}
      </Space>
    </Card>
  );
}

/* -- Model Panel -------------------------------------- */

function ModelPanel({ records }: { records: RealtimeRecord[] }) {
  if (records.length < 5) return null;

  const scores = records.map(r => r.anomaly_score);
  const maxScore = Math.max(...scores, 1);
  const attackScores = records.filter(r => r.is_attack).map(r => r.anomaly_score);
  const safeScores = records.filter(r => !r.is_attack).map(r => r.anomaly_score);
  const avgAttack = attackScores.length > 0 ? attackScores.reduce((sum, value) => sum + value, 0) / attackScores.length : 0;
  const avgSafe = safeScores.length > 0
    ? safeScores.reduce((sum, value) => sum + value, 0) / safeScores.length
    : scores.reduce((sum, value) => sum + value, 0) / scores.length;

  return (
    <Card
      title={
        <Flex align="center" gap={12}>
          <div style={{ width: 40, height: 40, borderRadius: 16, background: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} style={{ color: colors.primary }} />
          </div>
          <div>
            <Typography.Text strong>Как работает модель</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Объяснение текущего live-решения IDS.</Typography.Text>
          </div>
        </Flex>
      }
    >
      <Row gutter={24}>
        <Col xs={24} xl={12}>
          <Typography.Text strong style={{ color: colors.primary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Уровень 1: Автоэнкодер</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Модель учится на нормальном трафике, а потом измеряет reconstruction error. Чем выше score, тем сильнее поток выбивается из привычного профиля.
          </Typography.Paragraph>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <ScoreBar label="Нормальный трафик (avg)" value={avgSafe} max={maxScore} color={chart.safe} />
            {avgAttack > 0 && <ScoreBar label="Атаки (avg)" value={avgAttack} max={maxScore} color={chart.attack} />}
          </Space>
        </Col>
        <Col xs={24} xl={12}>
          <Typography.Text strong style={{ color: colors.info, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Уровень 2: Классификатор</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            После подтверждения аномалии классификатор определяет тип атаки по набору flow-признаков и прикладывает confidence к вердикту.
          </Typography.Paragraph>
          <Flex align="center" gap={8}>
            <Activity size={16} style={{ color: colors.textSecondary }} />
            <Typography.Text type="secondary">{records.length} потоков x 65 признаков в текущем окне</Typography.Text>
          </Flex>
        </Col>
      </Row>
    </Card>
  );
}

/* -- ScoreBar ----------------------------------------- */

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <Flex justify="space-between" style={{ marginBottom: 4 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{value.toFixed(4)}</Typography.Text>
      </Flex>
      <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
    </div>
  );
}
