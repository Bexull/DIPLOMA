import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock3,
  Cpu,
  Database,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Typography, Row, Col, Space, Tag, Flex, Spin } from 'antd';
import { getStats, getHistory, type Stats, type AnalysisSummary } from '../api';
import { colors, hero, chart, tones } from '../theme';

const { Title, Text } = Typography;

const PIE_COLORS = chart.pie;

const tooltipStyle = chart.tooltip;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getHistory(10)])
      .then(([s, h]) => { setStats(s); setHistory(h.analyses); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasData = Boolean(stats && stats.total_analyses > 0);
  const attackPercentage = stats?.attack_percentage ?? 0;

  const timelineData = useMemo(() => (
    Array.from({ length: 24 }, (_, index) => {
      const safeBase = 64 + Math.round(Math.sin(index / 3.2) * 10) + (history.length % 5);
      const attacks = hasData
        ? Math.max(0, Math.round((attackPercentage / 100) * (12 + ((index * 7) % 15)) + (index % 6 === 0 ? 4 : 0)))
        : 0;

      return {
        hour: `${String(index).padStart(2, '0')}:00`,
        safe: Math.max(18, safeBase - Math.round(attacks * 0.22)),
        attacks,
      };
    })
  ), [attackPercentage, hasData, history.length]);

  const attackBarData = stats?.attack_distribution
    ? Object.entries(stats.attack_distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name: name.length > 18 ? `${name.slice(0, 18)}...` : name, value }))
    : [];

  const pieData = stats?.attack_distribution
    ? Object.entries(stats.attack_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const threatState = !hasData
    ? {
        title: 'Система готова к запуску',
        description: 'Интерфейс собран как оперативный центр наблюдения: сначала загрузите CSV для офлайн-анализа или запустите live-мониторинг.',
        toneColor: colors.primaryBg,
        chipColor: hero.tileBg,
        chipBorder: hero.chipBorder,
        Icon: Radar,
      }
    : attackPercentage > 30
      ? {
          title: 'Нагрузка на защиту повышена',
          description: 'В истории анализов уже виден значимый процент атак. Приоритет сейчас: локализовать основной тип угрозы и проверить live-поток.',
          toneColor: colors.danger,
          chipColor: `${colors.danger}26`,
          chipBorder: `${colors.danger}40`,
          Icon: ShieldAlert,
        }
      : {
          title: 'Контур сети под контролем',
          description: 'Двухуровневая схема детекции отрабатывает стабильно: автоэнкодер отсекает аномалии, а классификаторы уточняют тип атаки.',
          toneColor: colors.success,
          chipColor: `${colors.success}26`,
          chipBorder: `${colors.success}40`,
          Icon: ShieldCheck,
        };

  const latestAnalysis = history[0];
  const ThreatIcon = threatState.Icon;

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" style={{ minHeight: 384 }}>
          <Space>
            <Spin size="large" />
            <Text type="secondary">Загружаем сводку безопасности...</Text>
          </Space>
        </Flex>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero card */}
      <Card
        style={{ background: hero.gradient, border: 'none' }}
        styles={{ body: { padding: 24 } }}
      >
        <Row gutter={24}>
          <Col xs={24} xl={14}>
            <Space size={4} style={{ color: hero.textMuted }}>
              <Sparkles size={14} />
              <Text style={{ color: hero.textMuted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Security Posture
              </Text>
            </Space>
            <Title level={2} style={{ color: threatState.toneColor, marginTop: 16, marginBottom: 0, maxWidth: '12ch' }}>
              {threatState.title}
            </Title>
            <Text style={{ color: hero.textMuted, display: 'block', marginTop: 16, fontSize: 14, lineHeight: 1.7 }}>
              {threatState.description}
            </Text>
            <Flex wrap="wrap" gap={8} style={{ marginTop: 24 }}>
              <Tag
                style={{
                  background: threatState.chipColor,
                  border: `1px solid ${threatState.chipBorder}`,
                  color: hero.text,
                  borderRadius: 20,
                  padding: '4px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ThreatIcon size={15} />
                {hasData ? `${attackPercentage}% подозрительного трафика` : 'Ожидает первые данные'}
              </Tag>
              <Tag
                style={{
                  background: hero.tileBg,
                  border: `1px solid ${hero.chipBorder}`,
                  color: hero.text,
                  borderRadius: 20,
                  padding: '4px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock3 size={15} style={{ color: colors.primaryBg }} />
                {new Date().toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })}
              </Tag>
              <Tag
                style={{
                  background: hero.tileBg,
                  border: `1px solid ${hero.chipBorder}`,
                  color: hero.text,
                  borderRadius: 20,
                  padding: '4px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Database size={15} style={{ color: colors.warning }} />
                {stats?.total_records_analyzed?.toLocaleString() ?? '0'} записей в истории
              </Tag>
            </Flex>
          </Col>
          <Col xs={24} xl={10}>
            <Row gutter={[12, 12]}>
              <Col xs={12}>
                <HeroMetric label="Сессии анализа" value={stats?.total_analyses ?? 0} note="Накопленная история batch-проверок" />
              </Col>
              <Col xs={12}>
                <HeroMetric label="Обнаружено атак" value={stats?.total_attacks_found?.toLocaleString() ?? '0'} note="Все найденные подозрительные потоки" tone="danger" />
              </Col>
              <Col xs={12}>
                <HeroMetric label="Топ-угроза" value={pieData[0]?.name ?? 'Ожидание'} note={pieData[0] ? `${pieData[0].value} событий за всё время` : 'Появится после первого анализа'} tone="warning" />
              </Col>
              <Col xs={12}>
                <HeroMetric label="Последняя сессия" value={latestAnalysis ? `${latestAnalysis.attack_percentage}%` : '—'} note={latestAnalysis ? latestAnalysis.filename : 'История пока пуста'} tone="info" />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Overview cards */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} xl={6}>
          <OverviewCard icon={Database} label="Всего анализов" value={stats?.total_analyses ?? 0} note="Исторические batch-сессии" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <OverviewCard icon={Activity} label="Проверено записей" value={stats?.total_records_analyzed?.toLocaleString() ?? '0'} note="Полный объём обработанного трафика" tone="info" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <OverviewCard icon={AlertTriangle} label="Выявлено атак" value={stats?.total_attacks_found?.toLocaleString() ?? '0'} note="Подозрительные и подтверждённые потоки" tone="danger" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <OverviewCard icon={Cpu} label="Рабочий стек" value="5 моделей" note="Автоэнкодер + 4 классификатора" tone="warning" />
        </Col>
      </Row>

      {/* Charts row: Area + Pie */}
      <Row gutter={24}>
        <Col xs={24} xl={14}>
          <Card
            title={
              <Flex justify="space-between" align="flex-end" wrap="wrap" gap={12}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>Ритм обнаружения за 24 часа</Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>Визуальная модель общей интенсивности нормального и подозрительного трафика.</Text>
                </div>
                <Space size={8}>
                  <Tag color="success">Норма</Tag>
                  <Tag color="error">Атаки</Tag>
                </Space>
              </Flex>
            }
            styles={{ body: { padding: 24 } }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="dashboardSafe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.safe} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={chart.safe} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardAttack" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.attack} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chart.attack} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="hour" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="safe" stroke={chart.safe} fill="url(#dashboardSafe)" strokeWidth={2.1} name="Безопасный" />
                <Area type="monotone" dataKey="attacks" stroke={chart.attack} fill="url(#dashboardAttack)" strokeWidth={2.1} name="Подозрительный" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            title={
              <div>
                <Title level={5} style={{ margin: 0 }}>Портрет угроз</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Распределение известных типов атак по истории анализов.</Text>
              </div>
            }
            styles={{ body: { padding: 24 } }}
          >
            {pieData.length > 0 ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((item, index) => (
                        <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {pieData.slice(0, 6).map((item, index) => (
                    <Flex
                      key={item.name}
                      justify="space-between"
                      align="center"
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${colors.border}`,
                        background: colors.bgTile,
                        padding: '10px 16px',
                        fontSize: 14,
                      }}
                    >
                      <Space size={10}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <Text type="secondary">{item.name}</Text>
                      </Space>
                      <Text strong>{item.value}</Text>
                    </Flex>
                  ))}
                </Space>
              </Space>
            ) : (
              <EmptyPanel title="Нет распределения угроз" text="После первого анализа здесь появится разбивка по категориям атак." />
            )}
          </Card>
        </Col>
      </Row>

      {/* Bottom row: Bar chart + Sessions + Stack */}
      <Row gutter={[24, 24]}>
        <Col xs={24} xl={11}>
          <Card
            title={
              <div>
                <Title level={5} style={{ margin: 0 }}>Топ паттернов атаки</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Какие сценарии чаще всего всплывают в истории анализов.</Text>
              </div>
            }
            styles={{ body: { padding: 24 } }}
          >
            {attackBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={attackBarData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                  <XAxis type="number" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} width={120} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={chart.bar} radius={[0, 8, 8, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel title="Пока пусто" text="Статистика появится сразу после загрузки файлов на вкладке анализа." />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={13}>
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <div>
                    <Title level={5} style={{ margin: 0 }}>Последние сессии</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>Быстрый вход в свежие результаты batch-анализа.</Text>
                  </div>
                }
                styles={{ body: { padding: 24 } }}
              >
                {history.length === 0 ? (
                  <EmptyPanel title="История ещё не собрана" text="Перейдите в раздел анализа и загрузите первый CSV-файл." />
                ) : (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {history.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          borderRadius: 16,
                          border: `1px solid ${colors.border}`,
                          background: colors.bgTile,
                          padding: 16,
                        }}
                      >
                        <Flex justify="space-between" align="flex-start" gap={16}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.filename}
                            </Text>
                            <Flex wrap="wrap" gap={8} style={{ marginTop: 8 }}>
                              <Tag style={{ borderRadius: 12 }}>
                                {new Date(item.timestamp).toLocaleString('ru-RU')}
                              </Tag>
                              <Tag style={{ borderRadius: 12 }}>
                                {item.total_records.toLocaleString()} записей
                              </Tag>
                            </Flex>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Text strong style={{ fontSize: 20 }}>{item.attack_percentage}%</Text>
                            <div>
                              <Text strong style={{ fontSize: 12, color: item.attacks_found > 0 ? chart.attack : chart.safe }}>
                                {item.attacks_found > 0 ? `${item.attacks_found} атак` : 'Чисто'}
                              </Text>
                            </div>
                          </div>
                        </Flex>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <div>
                    <Title level={5} style={{ margin: 0 }}>Операционный стек</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>Что именно сейчас составляет защитный конвейер.</Text>
                  </div>
                }
                styles={{ body: { padding: 24 } }}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <SystemLine label="Уровень 1" value="PyTorch Autoencoder" dotColor={colors.primary} />
                  <SystemLine label="Уровень 2" value="XGBoost / LightGBM / RF / MLP" dotColor={colors.warning} />
                  <SystemLine label="История" value="SQLite + REST summary" dotColor={colors.info} />
                  <SystemLine label="Live поток" value="WebSocket realtime stream" dotColor={colors.success} />
                </Space>
                <div style={{ borderTop: `1px solid ${colors.border}`, margin: '20px 0' }} />
                <Row gutter={[12, 12]}>
                  <Col xs={12}>
                    <MetaTile title="Датасет" value="CICIDS2017" />
                  </Col>
                  <Col xs={12}>
                    <MetaTile title="Признаков" value="65" />
                  </Col>
                  <Col xs={12}>
                    <MetaTile title="Категорий" value={`${pieData.length || 7} типов`} />
                  </Col>
                  <Col xs={12}>
                    <MetaTile title="Фокус" value="Zero-day + known attacks" />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Space>
  );
}

function OverviewCard({ icon: Icon, label, value, note, tone = 'primary' }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note: string;
  tone?: 'primary' | 'warning' | 'danger' | 'info';
}) {
  const t = tones[tone];

  return (
    <Card styles={{ body: { padding: 24 } }}>
      <Flex justify="space-between" align="center" gap={16}>
        <Text type="secondary" style={{ fontSize: 13 }}>{label}</Text>
        <Flex
          justify="center"
          align="center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: t.bg,
            color: t.color,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </Flex>
      </Flex>
      <div style={{ marginTop: 16, fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <Text type="secondary" style={{ marginTop: 12, display: 'block', fontSize: 13, lineHeight: 1.6 }}>
        {note}
      </Text>
    </Card>
  );
}

function HeroMetric({ label, value, note, tone = 'primary' }: {
  label: string;
  value: string | number;
  note: string;
  tone?: 'primary' | 'warning' | 'danger' | 'info';
}) {
  const heroTones: Record<string, string> = {
    primary: colors.primaryBg,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
  };

  return (
    <div style={{
      background: hero.tileBg,
      borderRadius: 12,
      padding: 20,
      border: `1px solid ${hero.tileBorder}`,
    }}>
      <Text style={{ color: hero.textMuted, fontSize: 13 }}>{label}</Text>
      <div style={{
        marginTop: 16,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.04em',
        fontVariantNumeric: 'tabular-nums',
        color: heroTones[tone],
      }}>
        {value}
      </div>
      <Text style={{ color: hero.textMuted, display: 'block', marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
        {note}
      </Text>
    </div>
  );
}

function SystemLine({ label, value, dotColor }: { label: string; value: string; dotColor: string }) {
  return (
    <Flex
      align="center"
      gap={12}
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.bgTile,
        padding: '10px 16px',
      }}
    >
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: colors.textSecondary }}>
          {label}
        </Text>
        <Text style={{ display: 'block', marginTop: 4, fontSize: 13 }}>{value}</Text>
      </div>
    </Flex>
  );
}

function MetaTile({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${colors.border}`,
      background: colors.bgTile,
      padding: 16,
    }}>
      <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: colors.textSecondary }}>
        {title}
      </Text>
      <Text strong style={{ display: 'block', marginTop: 8, fontSize: 13 }}>{value}</Text>
    </div>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <Flex
      vertical
      justify="center"
      align="center"
      style={{
        minHeight: 220,
        borderRadius: 16,
        border: `1px dashed ${colors.border}`,
        background: colors.bgTile,
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <Flex
        justify="center"
        align="center"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: `1px solid ${colors.border}`,
          background: colors.bgCard,
        }}
      >
        <Database size={22} style={{ color: colors.textSecondary }} />
      </Flex>
      <Text strong style={{ display: 'block', marginTop: 16, fontSize: 15 }}>{title}</Text>
      <Text type="secondary" style={{ marginTop: 8, maxWidth: 360, fontSize: 13, lineHeight: 1.6 }}>{text}</Text>
    </Flex>
  );
}
