import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Typography, Row, Col, Space, Tag, Progress, Flex, Spin, Alert } from 'antd';
import MetricsTable from '../components/MetricsTable';
import { getModels, type ModelInfo } from '../api';
import { Brain, Layers, Medal, Sparkles, Workflow } from 'lucide-react';
import { colors, hero, chart } from '../theme';

const { Title, Text, Paragraph } = Typography;

/** Convert hex color (#RRGGBB) to rgba string with given alpha */
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ModelComparison() {
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModels()
      .then((res) => {
        setSource(res.source);
        if (Array.isArray(res.models)) {
          const map: Record<string, ModelInfo> = {};
          for (const raw of res.models) {
            // API из БД возвращает model_type/accuracy напрямую,
            // а не вложенный metrics — нормализуем
            const m: ModelInfo = {
              model_name: (raw as any).model_name ?? (raw as any).type ?? 'Unknown',
              type: (raw as any).model_type ?? (raw as any).type ?? 'classifier',
              metrics: (raw as any).metrics ?? {
                accuracy: (raw as any).accuracy ?? 0,
                precision: (raw as any).precision_score ?? (raw as any).precision,
                precision_score: (raw as any).precision_score,
                recall: (raw as any).recall ?? 0,
                f1_weighted: (raw as any).f1_weighted,
                f1: (raw as any).f1,
                f1_macro: (raw as any).f1_macro,
                roc_auc: (raw as any).roc_auc ?? null,
              },
              confusion_matrix: (raw as any).confusion_matrix,
            };
            map[m.model_name!] = m;
          }
          setModels(map);
        } else {
          setModels(res.models as Record<string, ModelInfo>);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить метрики.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" style={{ padding: '80px 0' }}>
          <Space>
            <Spin />
            <Text type="secondary">Загружаем метрики моделей...</Text>
          </Space>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Title level={2}>Сравнение моделей</Title>
        <Alert type="error" message={error} showIcon />
      </Space>
    );
  }

  const classifiers = Object.entries(models).filter(([, m]) => m.type === 'classifier');
  const autoencoder = Object.entries(models).find(([, m]) => m.type === 'anomaly_detection');
  const bestClassifier = classifiers.reduce<{ name: string; model: ModelInfo } | null>((best, [name, model]) => {
    if (!best || model.metrics.accuracy > best.model.metrics.accuracy) return { name, model };
    return best;
  }, null);
  const averageAccuracy = classifiers.length > 0
    ? (classifiers.reduce((sum, [, model]) => sum + model.metrics.accuracy, 0) / classifiers.length) * 100
    : 0;

  const chartData = classifiers.map(([name, m]) => ({
    name: m.model_name || name,
    Accuracy: +(m.metrics.accuracy * 100).toFixed(2),
    'F1 Weighted': +((m.metrics.f1_weighted ?? m.metrics.f1 ?? 0) * 100).toFixed(2),
    'F1 Macro': +((m.metrics.f1_macro ?? 0) * 100).toFixed(2),
  }));

  const heroTileStyle: React.CSSProperties = {
    background: hero.tileBg,
    borderRadius: 12,
    padding: 20,
    border: `1px solid ${hero.tileBorder}`,
  };

  const heroLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: hero.textMuted,
  };

  const heroValueStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 600,
    color: hero.text,
    marginTop: 12,
  };

  const heroNoteStyle: React.CSSProperties = {
    fontSize: 13,
    color: hero.textMuted,
    marginTop: 8,
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero section */}
      <Card style={{ background: hero.gradient, border: 'none' }}>
        <Row gutter={24}>
          <Col xs={24} xl={14}>
            <Flex align="center" gap={6}>
              <Sparkles size={14} color={hero.kicker} />
              <Text style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: hero.kicker }}>
                Model Lab
              </Text>
            </Flex>
            <Title level={2} style={{ color: hero.text, marginTop: 16, marginBottom: 0 }}>
              Сравнивайте не только accuracy, но и роль модели в архитектуре IDS.
            </Title>
            <Paragraph style={{ color: hero.textMuted, marginTop: 16, marginBottom: 0, fontSize: 14 }}>
              Здесь видна двухуровневая логика проекта: автоэнкодер отвечает за аномалию, а классификаторы уточняют тип атаки. Поэтому важны и aggregate-метрики, и место модели в конвейере.
            </Paragraph>
            <Flex wrap="wrap" gap={8} style={{ marginTop: 24 }}>
              {source && (
                <Tag style={{ background: hero.chipBg, border: `1px solid ${hero.chipBorder}`, color: hero.text, borderRadius: 20 }}>
                  {source}
                </Tag>
              )}
              <Tag style={{ background: hero.chipBg, border: `1px solid ${hero.chipBorder}`, color: hero.text, borderRadius: 20 }}>
                <Flex align="center" gap={6}>
                  <Workflow size={15} />
                  2-stage detection pipeline
                </Flex>
              </Tag>
              <Tag style={{ background: hero.chipBg, border: `1px solid ${hero.chipBorder}`, color: hero.text, borderRadius: 20 }}>
                <Flex align="center" gap={6}>
                  <Layers size={15} />
                  {classifiers.length} классификатора в сравнении
                </Flex>
              </Tag>
            </Flex>
          </Col>
          <Col xs={24} xl={10}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div style={heroTileStyle}>
                  <div style={heroLabelStyle}>Лидер по accuracy</div>
                  <div style={heroValueStyle}>{bestClassifier?.model.model_name ?? '\u2014'}</div>
                  <div style={heroNoteStyle}>{bestClassifier ? `${(bestClassifier.model.metrics.accuracy * 100).toFixed(2)}% accuracy` : 'Нет данных'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={heroTileStyle}>
                  <div style={heroLabelStyle}>Средний accuracy</div>
                  <div style={heroValueStyle}>{averageAccuracy.toFixed(2)}%</div>
                  <div style={heroNoteStyle}>Среднее по всем классификаторам</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={heroTileStyle}>
                  <div style={heroLabelStyle}>Аномалия</div>
                  <div style={heroValueStyle}>{autoencoder?.[1].model_name ?? 'Autoencoder'}</div>
                  <div style={heroNoteStyle}>Первый уровень защиты</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={heroTileStyle}>
                  <div style={heroLabelStyle}>Фокус</div>
                  <div style={heroValueStyle}>Аномалии + классы</div>
                  <div style={heroNoteStyle}>Reconstruction error + классификация типа атаки</div>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Autoencoder + Classifiers */}
      <Row gutter={24}>
        {autoencoder && (
          <Col xs={24} xl={12}>
            <Card
              title={
                <Flex align="center" gap={10}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{ width: 40, height: 40, borderRadius: 16, background: colors.successBg, color: colors.primary }}
                  >
                    <Brain size={18} />
                  </Flex>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Уровень 1: Автоэнкодер</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>Обнаружение аномального трафика по ошибке реконструкции</div>
                  </div>
                </Flex>
              }
            >
              <Row gutter={[12, 12]}>
                {Object.entries(autoencoder[1].metrics).map(([key, val]) => (
                  <Col xs={24} sm={12} key={key}>
                    <div style={{ borderRadius: 20, border: `1px solid ${colors.border}`, background: colors.bgTile, padding: '16px 20px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: colors.textSecondary }}>
                        {key}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {typeof val === 'number' ? (val < 1 ? `${(val * 100).toFixed(2)}%` : val.toFixed(4)) : '\u2014'}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}

        <Col xs={24} xl={12}>
          <Card
            title={
              <Flex align="center" gap={10}>
                <Flex
                  align="center"
                  justify="center"
                  style={{ width: 40, height: 40, borderRadius: 16, background: colors.warningBg, color: colors.warning }}
                >
                  <Layers size={18} />
                </Flex>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Уровень 2: Классификаторы</div>
                  <div style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>Детализация типа атаки после подтверждения аномалии</div>
                </div>
              </Flex>
            }
          >
            {classifiers.map(([name, model]) => {
              const accuracy = +(model.metrics.accuracy * 100).toFixed(1);
              return (
                <div key={name} style={{ marginBottom: 16, borderRadius: 20, border: `1px solid ${colors.border}`, background: colors.bgTile, padding: '16px 20px' }}>
                  <Flex justify="space-between" align="center">
                    <Text strong>{model.model_name || name}</Text>
                    <Text style={{ color: colors.primary, fontVariantNumeric: 'tabular-nums' }}>{accuracy}%</Text>
                  </Flex>
                  <Progress
                    percent={accuracy}
                    showInfo={false}
                    strokeColor={colors.primary}
                    style={{ marginTop: 12 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    F1 weighted: {((model.metrics.f1_weighted ?? model.metrics.f1 ?? 0) * 100).toFixed(2)}%
                  </Text>
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      {/* Bar chart */}
      <Card
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Сравнение ключевых метрик</div>
            <div style={{ fontSize: 13, fontWeight: 400, color: colors.textSecondary, marginTop: 4 }}>Accuracy и F1-метрики по каждому классификатору.</div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="name" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={chart.tooltip}
              formatter={(value) => `${typeof value === 'number' ? value : Number(value ?? 0)}%`}
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            />
            <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: '12px' }} />
            <Bar dataKey="Accuracy" fill={chart.bar} radius={[6, 6, 0, 0]} maxBarSize={38} />
            <Bar dataKey="F1 Weighted" fill={colors.info} radius={[6, 6, 0, 0]} maxBarSize={38} />
            <Bar dataKey="F1 Macro" fill={colors.warning} radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Training details */}
      <Card
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Детали обучения</div>
            <div style={{ fontSize: 13, fontWeight: 400, color: colors.textSecondary, marginTop: 4 }}>Параметры датасета, предобработки и валидации.</div>
          </div>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bgTile, padding: '16px 20px' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Датасет</Text>
              <div style={{ marginTop: 8 }}>
                <Text strong>CICIDS2017-compatible (синтетический)</Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>200 000 записей, 65 признаков</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>8 классов: BENIGN, DDoS, DoS, PortScan, Brute Force, Web Attack, Bot, Infiltration</Text>
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bgTile, padding: '16px 20px' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Баланс классов</Text>
              <div style={{ marginTop: 8 }}>
                <Text strong>BENIGN: 60% (120 000)</Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>DDoS: 10%, DoS: 8%, PortScan: 8%, Brute Force: 5%, Web Attack: 4%, Bot: 3%, Infiltration: 2%</Text>
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bgTile, padding: '16px 20px' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Валидация</Text>
              <div style={{ marginTop: 8 }}>
                <Text strong>Train/Test: 80/20</Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>Стратифицированное разбиение (random_state=42). StandardScaler нормализация. Train: 160 000, Test: 40 000</Text>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Detailed metrics table */}
      <Card
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Детальные метрики</div>
            <div style={{ fontSize: 13, fontWeight: 400, color: colors.textSecondary, marginTop: 4 }}>Точная таблица значений для сравнения моделей бок о бок.</div>
          </div>
        }
      >
        <MetricsTable models={models} />
      </Card>

      {/* Confusion matrices */}
      {classifiers
        .filter(([, model]) => model.confusion_matrix?.length)
        .map(([name, model]) => {
          const cm = model.confusion_matrix!;
          const classLabels = ['BENIGN', 'Bot', 'Brute Force', 'DDoS', 'DoS', 'Infiltration', 'PortScan', 'Web Attack'];
          const totalSamples = cm.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
          const correctSamples = cm.reduce((s, row, i) => s + (row[i] ?? 0), 0);
          const fp = cm.reduce((s, row, i) => s + row.reduce((a, v, j) => j !== i ? a + v : a, 0), 0);
          const fn = cm.reduce((s, row, i) => s + row.reduce((a, value) => a + value, 0) - (row[i] ?? 0), 0);
          return (
          <Card
            key={name}
            title={
              <Flex align="center" gap={8}>
                <Medal size={16} style={{ color: colors.primary }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>Confusion Matrix — {model.model_name || name}</span>
              </Flex>
            }
          >
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={8}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: colors.bgTile, border: `1px solid ${colors.border}` }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Верных</Text>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.success }}>{correctSamples.toLocaleString()} <Text type="secondary" style={{ fontSize: 12 }}>/ {totalSamples.toLocaleString()}</Text></div>
                </div>
              </Col>
              <Col xs={8}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: colors.bgTile, border: `1px solid ${colors.border}` }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Ложные тревоги (FP)</Text>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.warning }}>{fp}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Норму приняли за атаку</Text>
                </div>
              </Col>
              <Col xs={8}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: colors.bgTile, border: `1px solid ${colors.border}` }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Пропущенные (FN)</Text>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.danger }}>{fn}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Атаку приняли за норму</Text>
                </div>
              </Col>
            </Row>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <td style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: colors.textSecondary }}>Факт \ Предсказание</td>
                    {classLabels.slice(0, cm.length).map((label) => (
                      <td key={label} style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: colors.textSecondary, textAlign: 'center', maxWidth: 60, wordBreak: 'break-word' }}>{label}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cm.map((row, i) => {
                    const rowMax = Math.max(...row, 1);
                    return (
                      <tr key={i}>
                        <td style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: colors.textSecondary, whiteSpace: 'nowrap' }}>{classLabels[i] ?? `Class ${i}`}</td>
                        {row.map((value, j) => (
                          <td
                            key={j}
                            style={{
                              height: 36,
                              minWidth: 36,
                              padding: '4px 6px',
                              border: `1px solid ${colors.border}`,
                              textAlign: 'center',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: i === j ? 700 : 400,
                              backgroundColor: value > 0
                                ? hexToRgba(i === j ? colors.success : colors.danger, Math.min(value / rowMax, 0.75))
                                : colors.bgTile,
                              color: value > 0 && (value / rowMax) > 0.5 ? '#ffffff' : colors.text,
                            }}
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12, marginBottom: 0 }}>
              Диагональ (зелёные) — верные предсказания. Вне диагонали (красные) — ошибки: строка показывает реальный класс, столбец — предсказанный.
            </Paragraph>
          </Card>
          );
        })}
    </Space>
  );
}
