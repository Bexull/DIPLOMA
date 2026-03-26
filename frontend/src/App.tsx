import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  BarChartOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { Shield } from 'lucide-react';
import { colors } from './theme';
import Dashboard from './pages/Dashboard';
import Analyze from './pages/Analyze';
import ModelComparison from './pages/ModelComparison';
import RealTime from './pages/RealTime';
import About from './pages/About';

const { Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: 'overview',
    label: 'ОБЗОР',
    type: 'group' as const,
    children: [
      { key: '/', label: 'Дашборд', icon: <DashboardOutlined /> },
      { key: '/analyze', label: 'Анализ', icon: <FileSearchOutlined /> },
    ],
  },
  {
    key: 'monitoring',
    label: 'МОНИТОРИНГ',
    type: 'group' as const,
    children: [
      { key: '/realtime', label: 'Мониторинг', icon: <RadarChartOutlined /> },
      { key: '/models', label: 'Модели', icon: <BarChartOutlined /> },
    ],
  },
  {
    key: 'system',
    label: 'СИСТЕМА',
    type: 'group' as const,
    children: [
      { key: '/about', label: 'О системе', icon: <InfoCircleOutlined /> },
    ],
  },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        width={260}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          overflow: 'auto',
          background: colors.sidebar,
        }}
      >
        <div style={{ padding: '24px 24px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={26} color={colors.primary} />
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.sidebarText }}>NetShield</span>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 8, background: 'transparent' }}
        />

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Text style={{ fontSize: 12, color: colors.sidebarMuted }}>NetShield IDS v1.0</Text>
          <br />
          <Text style={{ fontSize: 12, color: colors.sidebarMuted }}>Дипломная работа, 2026</Text>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 260, background: colors.bgPage }}>
        <Content style={{ padding: 32, minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/models" element={<ModelComparison />} />
            <Route path="/realtime" element={<RealTime />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
