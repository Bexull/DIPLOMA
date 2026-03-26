"""
Модуль захвата реального сетевого трафика.

Слушает сетевой интерфейс, собирает информацию о потоках (flows),
извлекает признаки и передаёт их в ML pipeline для анализа.
"""

import time
import threading
import numpy as np
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Optional

from scapy.all import sniff, IP, TCP, UDP, conf

# Отключаем verbose scapy
conf.verb = 0


@dataclass
class FlowStats:
    """Статистика одного сетевого потока (flow)."""
    src_ip: str = ''
    dst_ip: str = ''
    src_port: int = 0
    dst_port: int = 0
    protocol: str = ''
    start_time: float = 0.0
    last_time: float = 0.0
    fwd_packets: int = 0
    bwd_packets: int = 0
    fwd_bytes: int = 0
    bwd_bytes: int = 0
    fwd_pkt_lengths: list = field(default_factory=list)
    bwd_pkt_lengths: list = field(default_factory=list)
    fwd_iats: list = field(default_factory=list)
    bwd_iats: list = field(default_factory=list)
    last_fwd_time: float = 0.0
    last_bwd_time: float = 0.0
    fin_count: int = 0
    syn_count: int = 0
    rst_count: int = 0
    psh_count: int = 0
    ack_count: int = 0
    urg_count: int = 0
    fwd_psh_flags: int = 0
    init_win_fwd: int = 0
    init_win_bwd: int = 0
    fwd_header_len: int = 0
    bwd_header_len: int = 0
    active_times: list = field(default_factory=list)
    idle_times: list = field(default_factory=list)

    def duration_us(self) -> float:
        """Длительность потока в микросекундах."""
        return max((self.last_time - self.start_time) * 1e6, 1.0)

    def to_feature_vector(self) -> dict:
        """Преобразовать статистику потока в вектор признаков CICIDS2017."""
        duration = self.duration_us()
        total_fwd = self.fwd_packets
        total_bwd = self.bwd_packets
        total_pkts = total_fwd + total_bwd

        fwd_lens = self.fwd_pkt_lengths or [0]
        bwd_lens = self.bwd_pkt_lengths or [0]
        all_lens = fwd_lens + bwd_lens
        fwd_iats = self.fwd_iats or [0]
        bwd_iats = self.bwd_iats or [0]
        all_iats = fwd_iats + bwd_iats
        active = self.active_times or [0]
        idle = self.idle_times or [0]

        flow_bytes_s = (self.fwd_bytes + self.bwd_bytes) / (duration / 1e6) if duration > 0 else 0
        flow_pkts_s = total_pkts / (duration / 1e6) if duration > 0 else 0

        return {
            'Flow Duration': duration,
            'Total Fwd Packets': total_fwd,
            'Total Backward Packets': total_bwd,
            'Total Length of Fwd Packets': self.fwd_bytes,
            'Total Length of Bwd Packets': self.bwd_bytes,
            'Fwd Packet Length Max': max(fwd_lens),
            'Fwd Packet Length Min': min(fwd_lens),
            'Fwd Packet Length Mean': np.mean(fwd_lens),
            'Fwd Packet Length Std': np.std(fwd_lens),
            'Bwd Packet Length Max': max(bwd_lens),
            'Bwd Packet Length Min': min(bwd_lens),
            'Bwd Packet Length Mean': np.mean(bwd_lens),
            'Bwd Packet Length Std': np.std(bwd_lens),
            'Flow Bytes/s': flow_bytes_s,
            'Flow Packets/s': flow_pkts_s,
            'Flow IAT Mean': np.mean(all_iats),
            'Flow IAT Std': np.std(all_iats),
            'Flow IAT Max': max(all_iats),
            'Flow IAT Min': min(all_iats),
            'Fwd IAT Total': sum(fwd_iats),
            'Fwd IAT Mean': np.mean(fwd_iats),
            'Fwd IAT Std': np.std(fwd_iats),
            'Fwd IAT Max': max(fwd_iats),
            'Fwd IAT Min': min(fwd_iats),
            'Bwd IAT Total': sum(bwd_iats),
            'Bwd IAT Mean': np.mean(bwd_iats),
            'Bwd IAT Std': np.std(bwd_iats),
            'Bwd IAT Max': max(bwd_iats),
            'Bwd IAT Min': min(bwd_iats),
            'Fwd PSH Flags': self.fwd_psh_flags,
            'Fwd Header Length': self.fwd_header_len,
            'Bwd Header Length': self.bwd_header_len,
            'Fwd Packets/s': total_fwd / (duration / 1e6) if duration > 0 else 0,
            'Bwd Packets/s': total_bwd / (duration / 1e6) if duration > 0 else 0,
            'Min Packet Length': min(all_lens),
            'Max Packet Length': max(all_lens),
            'Packet Length Mean': np.mean(all_lens),
            'Packet Length Std': np.std(all_lens),
            'Packet Length Variance': np.var(all_lens),
            'FIN Flag Count': self.fin_count,
            'SYN Flag Count': self.syn_count,
            'RST Flag Count': self.rst_count,
            'PSH Flag Count': self.psh_count,
            'ACK Flag Count': self.ack_count,
            'URG Flag Count': self.urg_count,
            'Down/Up Ratio': total_bwd / total_fwd if total_fwd > 0 else 0,
            'Average Packet Size': np.mean(all_lens),
            'Avg Fwd Segment Size': np.mean(fwd_lens),
            'Avg Bwd Segment Size': np.mean(bwd_lens),
            'Subflow Fwd Packets': total_fwd,
            'Subflow Fwd Bytes': self.fwd_bytes,
            'Subflow Bwd Packets': total_bwd,
            'Subflow Bwd Bytes': self.bwd_bytes,
            'Init_Win_bytes_forward': self.init_win_fwd,
            'Init_Win_bytes_backward': self.init_win_bwd,
            'act_data_pkt_fwd': total_fwd,
            'min_seg_size_forward': min(fwd_lens) if fwd_lens else 0,
            'Active Mean': np.mean(active),
            'Active Std': np.std(active),
            'Active Max': max(active),
            'Active Min': min(active),
            'Idle Mean': np.mean(idle),
            'Idle Std': np.std(idle),
            'Idle Max': max(idle),
            'Idle Min': min(idle),
        }


class TrafficSniffer:
    """
    Захват и анализ сетевого трафика в реальном времени.

    Слушает сетевой интерфейс, собирает потоки,
    и вызывает callback с результатами классификации.
    """

    # Таймаут потока: если нет пакетов дольше FLOW_TIMEOUT секунд — поток завершён
    FLOW_TIMEOUT = 5.0

    def __init__(self, interface: Optional[str] = None):
        self.interface = interface
        self.flows: dict[str, FlowStats] = {}
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._export_thread: Optional[threading.Thread] = None
        self._on_flow: Optional[Callable] = None
        self._lock = threading.Lock()

    def start(self, on_flow: Callable[[dict], None], interface: Optional[str] = None):
        """
        Начать захват трафика.

        Args:
            on_flow: callback, вызывается для каждого завершённого потока
                     с dict из to_feature_vector() + метаданные (src_ip, dst_ip, etc.)
            interface: сетевой интерфейс (None = по умолчанию)
        """
        if self.running:
            return

        self.running = True
        self._on_flow = on_flow
        iface = interface or self.interface

        self._thread = threading.Thread(
            target=self._capture_loop,
            args=(iface,),
            daemon=True,
        )
        self._thread.start()

        self._export_thread = threading.Thread(
            target=self._export_loop,
            daemon=True,
        )
        self._export_thread.start()

    def stop(self):
        """Остановить захват."""
        self.running = False
        # Экспортируем оставшиеся потоки
        self._export_all_flows()

    def _capture_loop(self, interface: Optional[str]):
        """Основной цикл захвата пакетов."""
        try:
            sniff(
                iface=interface,
                prn=self._process_packet,
                stop_filter=lambda _: not self.running,
                store=False,
            )
        except PermissionError:
            print("ОШИБКА: Нужны права root/sudo для захвата трафика.")
            print("Запустите: sudo python -m app.ml.training")
            self.running = False
        except Exception as e:
            print(f"Ошибка захвата: {e}")
            self.running = False

    def _process_packet(self, packet):
        """Обработать один пакет."""
        if not packet.haslayer(IP):
            return

        ip = packet[IP]
        src_ip = ip.src
        dst_ip = ip.dst
        proto = 'TCP' if packet.haslayer(TCP) else ('UDP' if packet.haslayer(UDP) else 'OTHER')
        pkt_len = len(packet)
        now = time.time()

        src_port = dst_port = 0
        flags = ''
        win_size = 0
        header_len = ip.ihl * 4

        if packet.haslayer(TCP):
            tcp = packet[TCP]
            src_port = tcp.sport
            dst_port = tcp.dport
            flags = str(tcp.flags)
            win_size = tcp.window
            header_len += tcp.dataofs * 4 if tcp.dataofs else 20
        elif packet.haslayer(UDP):
            udp = packet[UDP]
            src_port = udp.sport
            dst_port = udp.dport
            header_len += 8

        # Ключ потока (двунаправленный)
        key_fwd = f"{src_ip}:{src_port}-{dst_ip}:{dst_port}-{proto}"
        key_bwd = f"{dst_ip}:{dst_port}-{src_ip}:{src_port}-{proto}"

        with self._lock:
            is_forward = True
            if key_fwd in self.flows:
                flow_key = key_fwd
            elif key_bwd in self.flows:
                flow_key = key_bwd
                is_forward = False
            else:
                flow_key = key_fwd
                self.flows[flow_key] = FlowStats(
                    src_ip=src_ip, dst_ip=dst_ip,
                    src_port=src_port, dst_port=dst_port,
                    protocol=proto, start_time=now, last_time=now,
                )

            flow = self.flows[flow_key]
            flow.last_time = now

            if is_forward:
                flow.fwd_packets += 1
                flow.fwd_bytes += pkt_len
                flow.fwd_pkt_lengths.append(pkt_len)
                flow.fwd_header_len += header_len
                if flow.last_fwd_time > 0:
                    flow.fwd_iats.append((now - flow.last_fwd_time) * 1e6)
                flow.last_fwd_time = now
                if flow.init_win_fwd == 0:
                    flow.init_win_fwd = win_size
            else:
                flow.bwd_packets += 1
                flow.bwd_bytes += pkt_len
                flow.bwd_pkt_lengths.append(pkt_len)
                flow.bwd_header_len += header_len
                if flow.last_bwd_time > 0:
                    flow.bwd_iats.append((now - flow.last_bwd_time) * 1e6)
                flow.last_bwd_time = now
                if flow.init_win_bwd == 0:
                    flow.init_win_bwd = win_size

            # TCP флаги
            if 'F' in flags: flow.fin_count += 1
            if 'S' in flags: flow.syn_count += 1
            if 'R' in flags: flow.rst_count += 1
            if 'P' in flags:
                flow.psh_count += 1
                if is_forward: flow.fwd_psh_flags += 1
            if 'A' in flags: flow.ack_count += 1
            if 'U' in flags: flow.urg_count += 1

    def _export_loop(self):
        """Периодически экспортировать завершённые потоки."""
        while self.running:
            time.sleep(1.0)
            self._export_expired_flows()

    def _export_expired_flows(self):
        """Экспортировать потоки, которые не активны дольше FLOW_TIMEOUT."""
        now = time.time()
        expired_keys = []

        with self._lock:
            for key, flow in self.flows.items():
                if now - flow.last_time > self.FLOW_TIMEOUT:
                    expired_keys.append(key)

            for key in expired_keys:
                flow = self.flows.pop(key)
                if flow.fwd_packets + flow.bwd_packets >= 2:
                    self._emit_flow(flow)

    def _export_all_flows(self):
        """Экспортировать все текущие потоки."""
        with self._lock:
            for flow in self.flows.values():
                if flow.fwd_packets + flow.bwd_packets >= 2:
                    self._emit_flow(flow)
            self.flows.clear()

    def _emit_flow(self, flow: FlowStats):
        """Отправить поток в callback."""
        if self._on_flow is None:
            return

        features = flow.to_feature_vector()
        features['_meta'] = {
            'src_ip': flow.src_ip,
            'dst_ip': flow.dst_ip,
            'src_port': flow.src_port,
            'dst_port': flow.dst_port,
            'protocol': flow.protocol,
        }
        self._on_flow(features)


def get_default_interface() -> Optional[str]:
    """Получить активный сетевой интерфейс."""
    import psutil
    stats = psutil.net_if_stats()
    for name, stat in stats.items():
        if stat.isup and name != 'lo' and name != 'lo0':
            return name
    return None
