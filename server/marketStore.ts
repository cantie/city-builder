import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MarketListing } from '../src/core/market';

export class MarketStore {
  constructor(private dir: string) {}

  private filePath(): string {
    return join(this.dir, 'listings.json');
  }

  async all(): Promise<MarketListing[]> {
    try {
      const raw = await readFile(this.filePath(), 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as MarketListing[]) : [];
    } catch {
      return [];
    }
  }

  async get(typeId: string): Promise<MarketListing | null> {
    return (await this.all()).find((l) => l.typeId === typeId) ?? null;
  }

  async upsert(listing: MarketListing): Promise<void> {
    const rows = await this.all();
    const next = rows.filter((l) => l.typeId !== listing.typeId);
    next.push(listing);
    await this.writeAll(next);
  }

  async unlist(typeId: string): Promise<void> {
    const rows = (await this.all()).filter((l) => l.typeId !== typeId);
    await this.writeAll(rows);
  }

  async removeOwnerSlot(owner: string, slot: string): Promise<void> {
    const rows = (await this.all()).filter(
      (l) => !(l.owner === owner && l.slot === slot),
    );
    await this.writeAll(rows);
  }

  async removeOwnerAll(owner: string): Promise<void> {
    const rows = (await this.all()).filter((l) => l.owner !== owner);
    await this.writeAll(rows);
  }

  private async writeAll(rows: MarketListing[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const path = this.filePath();
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(rows), 'utf8');
    await rename(tmp, path);
  }
}
