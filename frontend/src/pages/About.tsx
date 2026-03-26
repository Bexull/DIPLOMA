import { ArrowRight, Brain, Cpu, Layers, Monitor, Sparkles, Telescope, Workflow } from 'lucide-react';
import { Card, Typography, Row, Col, Space, Tag, Flex } from 'antd';
import { colors, hero } from '../theme';

const metricTileStyle: React.CSSProperties = {
  background: hero.tileBg,
  borderRadius: 12,
  padding: 20,
  border: `1px solid ${hero.tileBorder}`,
};

const archBlockStyles: Record<string, React.CSSProperties> = {
  blue:  { background: colors.infoBg, border: `1px solid ${colors.info}`, textAlign: 'center', minWidth: 140, borderRadius: 12, padding: 16 },
  cyan:  { background: colors.primaryBg, border: `1px solid ${colors.primary}`, textAlign: 'center', minWidth: 140, borderRadius: 12, padding: 16 },
  amber: { background: colors.warningBg, border: `1px solid ${colors.warning}`, textAlign: 'center', minWidth: 140, borderRadius: 12, padding: 16 },
  green: { background: colors.successBg, border: `1px solid ${colors.success}`, textAlign: 'center', minWidth: 140, borderRadius: 12, padding: 16 },
};

const models = [
  { name: 'Autoencoder', tech: 'PyTorch', desc: 'Обнаружение аномалий, encoder 65->32->16->8 и зеркальный decoder.' },
  { name: 'Random Forest', tech: 'scikit-learn', desc: 'Понятный baseline на ансамбле деревьев решений.' },
  { name: 'XGBoost', tech: 'xgboost', desc: 'Главный классификатор для точной типизации атак.' },
  { name: 'LightGBM', tech: 'lightgbm', desc: 'Быстрый бустинг для сравнения скорости и качества.' },
  { name: 'MLP Neural Net', tech: 'PyTorch', desc: 'Полносвязная нейросеть с 3 скрытыми слоями 128->64->32.' },
];

const stacks = [
  { cat: 'ML / AI', items: ['scikit-learn', 'XGBoost', 'LightGBM', 'PyTorch'] },
  { cat: 'Backend', items: ['FastAPI', 'SQLite', 'uvicorn', 'WebSocket'] },
  { cat: 'Frontend', items: ['React', 'TypeScript', 'Ant Design', 'Recharts'] },
];

export default function About() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero */}
      <Card style={{ background: hero.gradient, border: 'none' }}>
        <Row gutter={24}>
          <Col xs={24} xl={14}>
            <Typography.Text strong style={{ color: hero.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
              <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              About NetShield
            </Typography.Text>
            <Typography.Title level={2} style={{ color: hero.text, margin: '16px 0 0' }}>
              Это не просто набор графиков, а объяснимая оболочка вокруг двухуровневой IDS.
            </Typography.Title>
            <Typography.Paragraph style={{ color: hero.textMuted, marginTop: 16, marginBottom: 0 }}>
              Проект собран как дипломный security-console: один уровень ищет всё аномальное, второй объясняет, к какому типу атаки это ближе. Интерфейс подаёт архитектуру так, чтобы было видно и инженерную логику, и исследовательскую ценность.
            </Typography.Paragraph>
            <Space style={{ marginTop: 16 }} wrap>
              <Tag color="purple" icon={<Workflow size={15} style={{ verticalAlign: 'middle' }} />}>
                2-stage detection
              </Tag>
              <Tag color="purple" icon={<Telescope size={15} style={{ verticalAlign: 'middle' }} />}>
                Zero-day oriented
              </Tag>
              <Tag color="purple" icon={<Monitor size={15} style={{ verticalAlign: 'middle' }} />}>
                Dashboard + Live monitor
              </Tag>
            </Space>
          </Col>
          <Col xs={24} xl={10}>
            <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
              <div style={metricTileStyle}>
                <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Цель</Typography.Text>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: hero.text }}>Найти угрозу раньше</div>
              </div>
              <div style={metricTileStyle}>
                <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Подход</Typography.Text>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: hero.text }}>Autoencoder + Classifier</div>
              </div>
              <div style={metricTileStyle}>
                <Typography.Text style={{ color: hero.kicker, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Контекст</Typography.Text>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: hero.text }}>Дипломная работа, 2026</div>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Architecture flow */}
      <Card title="Архитектура обнаружения" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Поток данных проходит через несколько стадий</Typography.Text>}>
        <Flex justify="center" align="center" gap={16} wrap="wrap">
          <div style={archBlockStyles.blue}>
            <Typography.Text strong>Сетевой трафик</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Flow features</Typography.Text>
          </div>
          <ArrowRight size={16} style={{ color: colors.textMuted }} />
          <div style={archBlockStyles.cyan}>
            <Typography.Text strong>Автоэнкодер</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Аномалия?</Typography.Text>
          </div>
          <ArrowRight size={16} style={{ color: colors.textMuted }} />
          <div style={archBlockStyles.amber}>
            <Typography.Text strong>Классификатор</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Тип атаки</Typography.Text>
          </div>
          <ArrowRight size={16} style={{ color: colors.textMuted }} />
          <div style={archBlockStyles.green}>
            <Typography.Text strong>Вердикт</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Actionable result</Typography.Text>
          </div>
        </Flex>
      </Card>

      {/* Level 1 + Level 2 */}
      <Row gutter={24}>
        <Col xs={24} xl={12}>
          <Card
            title={
              <Flex align="center" gap={12}>
                <div style={{ width: 40, height: 40, borderRadius: 16, background: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={18} style={{ color: colors.primary }} />
                </div>
                <Typography.Text strong>Уровень 1: Автоэнкодер</Typography.Text>
              </Flex>
            }
          >
            <Typography.Paragraph type="secondary">
              Нейросеть обучена только на нормальном трафике. Она пытается восстановить входной вектор признаков и использует reconstruction error как сигнал аномалии. Это даёт шанс заметить и неизвестные атаки, которые не входят в train-набор.
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            title={
              <Flex align="center" gap={12}>
                <div style={{ width: 40, height: 40, borderRadius: 16, background: colors.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} style={{ color: colors.warning }} />
                </div>
                <Typography.Text strong>Уровень 2: Классификатор</Typography.Text>
              </Flex>
            }
          >
            <Typography.Paragraph type="secondary">
              После подтверждения аномалии поток передаётся в один из классических ML-классификаторов. Они отличают DDoS, PortScan, Brute Force, Web Attack и другие категории, чтобы итоговый вердикт был пригоден для расследования.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      {/* Models list */}
      <Card title="Модели и роли" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Каждая модель добавляет свою полезность</Typography.Text>}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {models.map(model => (
            <Card size="small" key={model.name}>
              <Flex align="center" gap={12}>
                <Cpu size={18} style={{ color: colors.textSecondary, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong>{model.name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">{model.desc}</Typography.Text>
                </div>
                <Tag>{model.tech}</Tag>
              </Flex>
            </Card>
          ))}
        </Space>
      </Card>

      {/* Tech stack */}
      <Card title="Стек технологий" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>ML-контур, API и интерфейс визуализации</Typography.Text>}>
        <Row gutter={24}>
          {stacks.map(stack => (
            <Col xs={24} md={8} key={stack.cat}>
              <Card size="small" style={{ background: colors.bgTile }}>
                <Typography.Text strong style={{ color: colors.primary, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>{stack.cat}</Typography.Text>
                {stack.items.map(item => (
                  <div key={item} style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">{item}</Typography.Text>
                  </div>
                ))}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}
