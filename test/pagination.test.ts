import { describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction } from 'discord.js';
import { Paginator, PaginatorRegistry, cursorPaginator, staticPaginator } from '../src/discord/pagination.js';
import { baseEmbed } from '../src/discord/embeds/formatting.js';

function makeInteraction(customId: string, userId: string): ButtonInteraction {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    reply: vi.fn(async () => undefined),
  } as unknown as ButtonInteraction;
}

function pageEmbed(index: number) {
  return baseEmbed('Blurple', `Page ${index}`).toJSON();
}

describe('staticPaginator', () => {
  it('exposes boundaries for first and last pages', async () => {
    const loader = staticPaginator([[pageEmbed(0)], [pageEmbed(1)], [pageEmbed(2)]]);
    const p0 = await loader(0);
    expect(p0?.canGoPrev).toBe(false);
    expect(p0?.canGoNext).toBe(true);
    const p2 = await loader(2);
    expect(p2?.canGoNext).toBe(false);
    expect(p2?.canGoPrev).toBe(true);
    expect(await loader(3)).toBeNull();
    expect(await loader(-1)).toBeNull();
  });
});

describe('cursorPaginator', () => {
  it('builds pages lazily through a loader', async () => {
    const buildPage = vi.fn(async (index: number) => {
      if (index > 1) return null;
      return { embeds: [pageEmbed(index)], canGoNext: index < 1 };
    });
    const loader = cursorPaginator(buildPage);
    const p0 = await loader(0);
    expect(p0?.embeds[0]?.title).toBe('Page 0');
    expect(p0?.canGoNext).toBe(true);
    const p1 = await loader(1);
    expect(p1?.canGoNext).toBe(false);
    expect(await loader(2)).toBeNull();
  });
});

describe('Paginator', () => {
  it('builds an initial payload with prev disabled on page 0', async () => {
    const paginator = new Paginator({
      userId: 'u1',
      loader: staticPaginator([[pageEmbed(0)], [pageEmbed(1)]]),
    });
    const payload = await paginator.buildPayload();
    const buttons = payload.components?.[0]?.components ?? [];
    expect(buttons[0]?.data.disabled).toBe(true);
    expect(buttons[1]?.data.disabled).toBe(false);
  });

  it('navigates forward and backward on button clicks', async () => {
    const interaction = makeInteraction('pagenav:next', 'u1');
    const paginator = new Paginator({
      userId: 'u1',
      id: 'pagenav',
      loader: staticPaginator([[pageEmbed(0)], [pageEmbed(1)], [pageEmbed(2)]]),
    });

    const handled = await paginator.handle(interaction);
    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(paginator.pageIndex).toBe(1);

    const prevInteraction = makeInteraction('pagenav:prev', 'u1');
    await paginator.handle(prevInteraction);
    expect(paginator.pageIndex).toBe(0);
  });

  it('ignores interactions for other paginators', async () => {
    const interaction = makeInteraction('other:next', 'u1');
    const paginator = new Paginator({
      userId: 'u1',
      id: 'mine',
      loader: staticPaginator([[pageEmbed(0)]]),
    });
    expect(await paginator.handle(interaction)).toBe(false);
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('blocks other users with an ephemeral reply', async () => {
    const interaction = makeInteraction('locked:next', 'u2');
    const paginator = new Paginator({
      userId: 'u1',
      id: 'locked',
      loader: staticPaginator([[pageEmbed(0)]]),
    });
    await paginator.handle(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('does not navigate past the last page', async () => {
    const interaction = makeInteraction('end:next', 'u1');
    const paginator = new Paginator({
      userId: 'u1',
      id: 'end',
      loader: staticPaginator([[pageEmbed(0)]]),
    });
    await paginator.handle(interaction);
    expect(paginator.pageIndex).toBe(0);
    expect(interaction.update).not.toHaveBeenCalled();
  });

  it('expires after the timeout', () => {
    const paginator = new Paginator({
      userId: 'u1',
      id: 'exp',
      timeoutMs: 1000,
      loader: staticPaginator([[pageEmbed(0)]]),
    });
    expect(paginator.isExpired).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    expect(paginator.isExpired).toBe(true);
    vi.restoreAllMocks();
  });

  it('handles rapid clicks without racing page loads', async () => {
    const interaction = makeInteraction('race:next', 'u1');
    const paginator = new Paginator({
      userId: 'u1',
      id: 'race',
      loader: async (index) => {
        await new Promise((r) => setTimeout(r, 5));
        if (index > 1) return null;
        return { embeds: [pageEmbed(index)], canGoNext: index < 1, canGoPrev: index > 0 };
      },
    });
    const first = paginator.handle(interaction);
    const second = paginator.handle(interaction); // while first is active
    await Promise.all([first, second]);
    expect(paginator.pageIndex).toBe(1);
  });
});

describe('PaginatorRegistry', () => {
  it('registers, retrieves and removes paginators', () => {
    const registry = new PaginatorRegistry();
    const paginator = new Paginator({
      userId: 'u1',
      id: 'p1',
      loader: staticPaginator([[pageEmbed(0)]]),
    });
    registry.register(paginator);
    expect(registry.get('p1')).toBe(paginator);
    expect(registry.size).toBe(1);
    registry.remove('p1');
    expect(registry.size).toBe(0);
  });

  it('cleans up expired paginators', () => {
    const registry = new PaginatorRegistry();
    registry.register(
      new Paginator({ userId: 'u1', id: 'old', timeoutMs: 1, loader: staticPaginator([[pageEmbed(0)]]) }),
    );
    registry.register(
      new Paginator({ userId: 'u1', id: 'new', timeoutMs: 10_000, loader: staticPaginator([[pageEmbed(0)]]) }),
    );
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
    registry.cleanup();
    expect(registry.get('old')).toBeUndefined();
    expect(registry.get('new')).toBeDefined();
    vi.restoreAllMocks();
  });
});