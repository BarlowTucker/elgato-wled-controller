import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WLEDClient } from '../WLEDClient';
import type { WLEDInfo, WLEDState } from '../types';

const mockInfo: WLEDInfo = {
  ver: '0.14.0',
  name: 'WLED Test',
  udpport: 21324,
  live: false,
  fxcount: 118,
  palcount: 71,
};

const mockState: WLEDState = {
  on: true,
  bri: 128,
  ps: -1,
  pl: -1,
  nl: { on: false, dur: 60, mode: 1, tbri: 0, rem: -1 },
  udpn: { send: false, recv: false },
  lor: 0,
  mainseg: 0,
};

describe('WLEDClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getInfo()', () => {
    it('fetches /json/info and returns parsed WLEDInfo', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfo),
      });

      const client = new WLEDClient('http://192.168.1.50:80');
      const info = await client.getInfo();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://192.168.1.50:80/json/info',
        expect.objectContaining({ signal: expect.anything() })
      );
      expect(info).toEqual(mockInfo);
    });

    it('throws on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const client = new WLEDClient('http://192.168.1.50:80');
      await expect(client.getInfo()).rejects.toThrow('WLED HTTP 404');
    });

    it('throws on timeout (AbortSignal.timeout behavior)', async () => {
      fetchMock.mockRejectedValueOnce(
        Object.assign(new DOMException('The operation was aborted', 'AbortError'), {
          name: 'AbortError',
        })
      );

      const client = new WLEDClient('http://192.168.1.50:80');
      await expect(client.getInfo()).rejects.toThrow();
    });
  });

  describe('getState()', () => {
    it('fetches /json/state and returns parsed WLEDState', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockState),
      });

      const client = new WLEDClient('http://192.168.1.50:80');
      const state = await client.getState();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://192.168.1.50:80/json/state',
        expect.objectContaining({ signal: expect.anything() })
      );
      expect(state).toEqual(mockState);
    });
  });

  describe('setState()', () => {
    it('POSTs to /json/state with JSON body and correct Content-Type header', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      const client = new WLEDClient('http://192.168.1.50:80');
      await client.setState({ on: false, bri: 64 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://192.168.1.50:80/json/state',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: false, bri: 64 }),
          signal: expect.anything(),
        })
      );
    });

    it('throws on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const client = new WLEDClient('http://192.168.1.50:80');
      await expect(client.setState({ on: true })).rejects.toThrow('WLED HTTP 500');
    });
  });

  describe('isOnline()', () => {
    it('returns true when getInfo succeeds', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfo),
      });

      const client = new WLEDClient('http://192.168.1.50:80');
      const online = await client.isOnline();
      expect(online).toBe(true);
    });

    it('returns false when getInfo throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const client = new WLEDClient('http://192.168.1.50:80');
      const online = await client.isOnline();
      expect(online).toBe(false);
    });
  });

  describe('fromHostPort() static factory', () => {
    it('parses plain host to http://host:80', () => {
      const client = WLEDClient.fromHostPort('192.168.1.50');
      // Access internal baseUrl via cast for testing
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe('http://192.168.1.50:80');
    });

    it('parses host:port to http://host:port', () => {
      const client = WLEDClient.fromHostPort('192.168.1.50:8080');
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe('http://192.168.1.50:8080');
    });
  });
});
