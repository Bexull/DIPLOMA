import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ModelInfo } from '../api';

interface Props {
  models: Record<string, ModelInfo>;
}

const fmt = (v: number | undefined | null): string => {
  if (v == null) return '\u2014';
  return (v * 100).toFixed(2) + '%';
};

interface DataRow {
  key: string;
  name: string;
  accuracy: string;
  precision: string;
  recall: string;
  f1_weighted: string;
  f1_macro: string;
  roc_auc: string;
}

export default function MetricsTable({ models }: Props) {
  const entries = Object.entries(models).filter(([, m]) => m.type === 'classifier');

  const dataSource: DataRow[] = entries.map(([name, m]) => ({
    key: name,
    name: m.model_name || name,
    accuracy: fmt(m.metrics.accuracy),
    precision: fmt(m.metrics.precision ?? m.metrics.precision_score),
    recall: fmt(m.metrics.recall),
    f1_weighted: fmt(m.metrics.f1_weighted ?? m.metrics.f1),
    f1_macro: fmt(m.metrics.f1_macro),
    roc_auc: m.metrics.roc_auc != null ? fmt(m.metrics.roc_auc) : '\u2014',
  }));

  const columns: ColumnsType<DataRow> = [
    { title: '\u041C\u043E\u0434\u0435\u043B\u044C', dataIndex: 'name', key: 'name' },
    { title: 'Accuracy', dataIndex: 'accuracy', key: 'accuracy', align: 'right' },
    { title: 'Precision', dataIndex: 'precision', key: 'precision', align: 'right' },
    { title: 'Recall', dataIndex: 'recall', key: 'recall', align: 'right' },
    { title: 'F1 weighted', dataIndex: 'f1_weighted', key: 'f1_weighted', align: 'right' },
    { title: 'F1 macro', dataIndex: 'f1_macro', key: 'f1_macro', align: 'right' },
    { title: 'ROC AUC', dataIndex: 'roc_auc', key: 'roc_auc', align: 'right' },
  ];

  return <Table<DataRow> dataSource={dataSource} columns={columns} pagination={false} size="middle" />;
}
