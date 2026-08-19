import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  type APIEmbed,
} from 'discord.js';

export interface Page {
  embeds: APIEmbed[];
  /** Whether a "next" page exists. */
  canGoNext: boolean;
  /** Whether a "previous" page exists. */
  canGoPrev: boolean;
}

/**
 * Async page loader. For cursor/keyset pagination a page may need a fresh
 * API request; for static content the loader returns pre-built embeds.
 */
export type PageLoader = (index: number) => Promise<Page | null>;

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/**
 * Handles a paginated embed message with ◀ ▶ buttons.
 * Only the originating user may navigate, and a single active interaction is
 * allowed at a time to avoid racing page loads.
 */
export class Paginator {
  readonly id: string;
  private readonly userId: string;
  private readonly loader: PageLoader;
  private readonly cache = new Map<number, Page>();
  private current = 0;
  private active = false;
  private lastActive = Date.now();
  private timeoutMs: number;

  constructor(options: { userId: string; loader: PageLoader; id?: string; timeoutMs?: number; initialPage?: number }) {
    this.userId = options.userId;
    this.loader = options.loader;
    this.id = options.id ?? `p${Math.random().toString(36).slice(2, 10)}`;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.current = options.initialPage ?? 0;
  }

  get isExpired(): boolean {
    return Date.now() - this.lastActive > this.timeoutMs;
  }

  get ownerId(): string {
    return this.userId;
  }

  get pageIndex(): number {
    return this.current;
  }

  /** Builds the reply payload for the current page. */
  async buildPayload(): Promise<{ embeds: APIEmbed[]; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const page = await this.loadPage(this.current);
    if (!page) throw new Error('Paginator page could not be loaded');
    return { embeds: page.embeds, components: this.components(page) };
  }

  /**
   * Handles a button interaction if it belongs to this paginator and user.
   * Returns true when handled, false when the interaction belongs elsewhere.
   */
  async handle(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== `${this.id}:prev` && interaction.customId !== `${this.id}:next`) {
      return false;
    }
    if (interaction.user.id !== this.userId) {
      await interaction.reply({ content: 'You cannot control someone else’s pagination.', ephemeral: true });
      return true;
    }
    if (this.active) {
      await interaction.deferUpdate();
      return true;
    }

    this.active = true;
    try {
      const direction = interaction.customId.endsWith('prev') ? -1 : 1;
      const next = this.current + direction;
      const page = await this.loadPage(next);
      if (!page) {
        await interaction.deferUpdate();
        return true;
      }
      this.current = next;
      this.lastActive = Date.now();
      await interaction.update({ embeds: page.embeds, components: this.components(page) });
    } finally {
      this.active = false;
    }
    return true;
  }

  private async loadPage(index: number): Promise<Page | null> {
    if (index < 0) return null;
    const cached = this.cache.get(index);
    if (cached) return cached;
    const page = await this.loader(index);
    if (page) this.cache.set(index, page);
    return page;
  }

  private components(page: Page): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${this.id}:prev`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!page.canGoPrev),
      new ButtonBuilder()
        .setCustomId(`${this.id}:next`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!page.canGoNext),
    );
    return [row];
  }
}

/** Static paginator helper: builds a page loader from pre-rendered embed arrays. */
export function staticPaginator(embeds: APIEmbed[][]): PageLoader {
  return (index: number) => {
    const page = embeds[index];
    if (!page) return Promise.resolve(null);
    return Promise.resolve({
      embeds: page,
      canGoNext: index < embeds.length - 1,
      canGoPrev: index > 0,
    });
  };
}

/** Dynamic paginator helper for cursor/keyset pagination. */
export function cursorPaginator(
  buildPage: (index: number) => Promise<{ embeds: APIEmbed[]; canGoNext: boolean } | null>,
): PageLoader {
  return async (index: number) => {
    if (index < 0) return null;
    const page = await buildPage(index);
    if (!page) return null;
    return { embeds: page.embeds, canGoNext: page.canGoNext, canGoPrev: index > 0 };
  };
}

/** Tracks active paginators by id for button routing and expiry cleanup. */
export class PaginatorRegistry {
  private readonly paginators = new Map<string, Paginator>();

  register(paginator: Paginator): void {
    this.paginators.set(paginator.id, paginator);
  }

  get(id: string): Paginator | undefined {
    return this.paginators.get(id);
  }

  remove(id: string): void {
    this.paginators.delete(id);
  }

  /** Removes paginators idle past their timeout. */
  cleanup(): void {
    for (const [id, paginator] of this.paginators) {
      if (paginator.isExpired) this.paginators.delete(id);
    }
  }

  get size(): number {
    return this.paginators.size;
  }
}