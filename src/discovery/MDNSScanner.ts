import mdns from 'multicast-dns';

export interface DiscoveredDevice {
  ip: string;
  name: string;
}

export class MDNSScanner {
  async scan(timeoutMs = 4000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const m = mdns();
      const discovered = new Map<string, DiscoveredDevice>();

      const done = () => {
        m.destroy();
        resolve(Array.from(discovered.values()));
      };

      const timer = setTimeout(done, timeoutMs);

      m.on('response', (response) => {
        // Check both answers and additionals for A records (per RFC 6762)
        const aRecords = [
          ...response.answers.filter((r: any) => r.type === 'A'),
          ...response.additionals.filter((r: any) => r.type === 'A'),
        ];

        for (const record of aRecords) {
          const ip: string = (record as any).data;
          if (!discovered.has(ip)) {
            const name = (record.name as string).replace(/\.local\.?$/, '');
            discovered.set(ip, { ip, name });
          }
        }
      });

      m.on('error', () => {
        clearTimeout(timer);
        done();
      });

      m.query({ questions: [{ name: '_wled._tcp.local', type: 'PTR' }] });
    });
  }
}
