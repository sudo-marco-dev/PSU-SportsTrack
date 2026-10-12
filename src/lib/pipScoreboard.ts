export type PipScoreboardData = {
  sport: string;
  round: string;
  status: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  pointUnit: string;
  latestEvent?: string;
};

class PipScoreboardController {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private currentData: PipScoreboardData | null = null;
  private onStateChangeCallbacks: Set<(isActive: boolean) => void> = new Set();

  private initElements() {
    if (this.canvas && this.video) return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext('2d');

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.style.position = 'fixed';
    this.video.style.top = '-9999px';
    this.video.style.left = '-9999px';
    this.video.style.width = '1px';
    this.video.style.height = '1px';
    this.video.style.opacity = '0';
    this.video.style.pointerEvents = 'none';

    document.body.appendChild(this.video);

    this.video.addEventListener('leavepictureinpicture', () => {
      this.notifyStateChange(false);
    });
  }

  public isSupported(): boolean {
    return (
      typeof document !== 'undefined' &&
      'pictureInPictureEnabled' in document &&
      !!(document as any).pictureInPictureEnabled
    );
  }

  public isActive(): boolean {
    if (!this.video || typeof document === 'undefined') return false;
    return document.pictureInPictureElement === this.video;
  }

  public getCurrentData(): PipScoreboardData | null {
    return this.currentData;
  }

  public subscribeStateChange(cb: (isActive: boolean) => void): () => void {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  private notifyStateChange(isActive: boolean) {
    this.onStateChangeCallbacks.forEach((cb) => {
      try {
        cb(isActive);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error in PiP state listener:', err);
      }
    });
  }

  public draw(data: PipScoreboardData) {
    this.initElements();
    this.currentData = data;
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Background: Deep nocturnal stadium slate
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Subtle arena radial orange glow
    const radial = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, w * 0.7);
    radial.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
    radial.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, w, h);

    // Solar Orange accent court border
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // 2. Top Header Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(4, 4, w - 8, 44);

    // Sport & Round label
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${(data.sport || 'BALL GAME').toUpperCase()} • ${data.round.toUpperCase()}`, 18, 32);

    // Live / Status pill on right
    const isOngoing = data.status === 'Ongoing';
    ctx.fillStyle = isOngoing ? '#ef4444' : '#64748b';
    ctx.beginPath();
    ctx.arc(w - 74, 26, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isOngoing ? '#fca5a5' : '#cbd5e1';
    ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(isOngoing ? 'LIVE' : data.status.toUpperCase(), w - 62, 31);

    // 3. Center Scores & Team Names
    // Left: Team A
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const teamAName = data.teamAName.length > 15 ? data.teamAName.slice(0, 14) + '…' : data.teamAName;
    ctx.fillText(teamAName.toUpperCase(), w * 0.25, 95);

    const maxDigits = Math.max(String(data.teamAScore).length, String(data.teamBScore).length);
    const scoreFontSize = maxDigits >= 3 ? '60px' : '74px';
    const scoreFont = `900 ${scoreFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

    ctx.fillStyle = '#ffffff';
    ctx.font = scoreFont;
    ctx.fillText(String(data.teamAScore), w * 0.25, 172);

    // Center Pillar: VS
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(w / 2, 135, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.font = 'italic 900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('VS', w / 2, 142);

    // Right: Team B
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const teamBName = data.teamBName.length > 15 ? data.teamBName.slice(0, 14) + '…' : data.teamBName;
    ctx.fillText(teamBName.toUpperCase(), w * 0.75, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = scoreFont;
    ctx.fillText(String(data.teamBScore), w * 0.75, 172);

    // 4. Point unit tags
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(data.pointUnit, w * 0.25, 195);
    ctx.fillText(data.pointUnit, w * 0.75, 195);

    // 5. Bottom Live Play-by-Play Ticker Box
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(4, h - 46, w - 8, 42);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, h - 46);
    ctx.lineTo(w - 4, h - 46);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f97316';
    ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('LATEST:', 16, h - 20);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const eventText = data.latestEvent || 'Match in progress • Scores sync live in real-time';
    const truncatedEvent = eventText.length > 52 ? eventText.slice(0, 50) + '…' : eventText;
    ctx.fillText(truncatedEvent, 78, h - 20);
  }

  public async openPip(data: PipScoreboardData): Promise<boolean> {
    if (!this.isSupported()) return false;

    this.initElements();
    this.draw(data);

    if (!this.canvas || !this.video) return false;

    try {
      // Connect canvas capture stream to video element
      if (!this.video.srcObject) {
        const stream = this.canvas.captureStream(15);
        this.video.srcObject = stream;
      }

      await this.video.play();

      if (document.pictureInPictureElement !== this.video) {
        await this.video.requestPictureInPicture();
        this.notifyStateChange(true);
      }
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to open PiP window:', err);
      return false;
    }
  }

  public async closePip(): Promise<void> {
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        this.notifyStateChange(false);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error exiting PiP:', err);
      }
    }
  }

  public async togglePip(data: PipScoreboardData): Promise<boolean> {
    if (this.isActive()) {
      await this.closePip();
      return false;
    } else {
      return await this.openPip(data);
    }
  }
}

export const pipScoreboard = new PipScoreboardController();
