import { Upload, Typography, Space, Tag, Spin } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { colors } from '../theme';

interface Props {
  onFile: (file: File) => void;
  loading?: boolean;
}

export default function FileUpload({ onFile, loading }: Props) {
  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      onFile(file);
      return false;
    },
  };

  return (
    <Spin spinning={!!loading} tip="Анализируем трафик...">
      <Upload.Dragger
        {...props}
        disabled={loading}
        style={{ padding: '32px 0', borderRadius: 16, background: colors.bgTile }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 48, color: colors.primary }} />
        </p>
        <Typography.Title level={5}>Перетащите CSV-файл сюда</Typography.Title>
        <Typography.Text type="secondary">
          или нажмите для выбора файла. Оптимальный формат: CICIDS2017-compatible flow features.
        </Typography.Text>
        <div style={{ marginTop: 16 }}>
          <Space>
            <Tag>.csv only</Tag>
            <Tag>до 10k записей</Tag>
            <Tag>ready for batch analysis</Tag>
          </Space>
        </div>
      </Upload.Dragger>
    </Spin>
  );
}
