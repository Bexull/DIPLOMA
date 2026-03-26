import { Alert } from 'antd';
import { colors, hero } from '../theme';

interface Props {
  type: 'success' | 'error' | 'info';
  message: string;
}

const typeMap = { success: 'success', error: 'error', info: 'info' } as const;

export default function AlertBanner({ type, message }: Props) {
  return <Alert type={typeMap[type]} message={message} showIcon style={{ borderRadius: 12 }} />;
}
