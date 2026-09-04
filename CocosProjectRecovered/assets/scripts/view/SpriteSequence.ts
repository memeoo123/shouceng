import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass } = _decorator;

@ccclass('SpriteSequence')
export class SpriteSequence extends Component {
  private frames: SpriteFrame[] = [];
  private intervalSeconds = 0.102;
  private elapsed = 0;
  private frameIndex = 0;
  private loop = true;
  private onComplete: (() => void) | null = null;
  private playing = false;

  public play(frames: SpriteFrame[], intervalSeconds = 0.102, loop = true, onComplete?: () => void): void {
    this.frames = frames;
    this.intervalSeconds = intervalSeconds;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.loop = loop;
    this.onComplete = onComplete ?? null;
    this.playing = frames.length > 0;
    this.applyFrame();
  }

  public update(deltaTime: number): void {
    if (!this.playing || this.frames.length < 2) return;
    this.elapsed += deltaTime;
    while (this.elapsed >= this.intervalSeconds) {
      this.elapsed -= this.intervalSeconds;
      const nextFrame = this.frameIndex + 1;
      if (nextFrame >= this.frames.length && !this.loop) {
        this.frameIndex = this.frames.length - 1;
        this.playing = false;
        this.applyFrame();
        const callback = this.onComplete;
        this.onComplete = null;
        callback?.();
        return;
      }
      this.frameIndex = nextFrame % this.frames.length;
      this.applyFrame();
    }
  }

  public getCurrentFrameIndex(): number {
    return this.frameIndex;
  }

  public getCurrentFrameName(): string | null {
    return this.frames[this.frameIndex]?.name ?? null;
  }

  public seek(frameIndex: number): void {
    if (this.frames.length === 0) return;
    this.frameIndex = Math.max(0, Math.min(this.frames.length - 1, Math.trunc(frameIndex)));
    this.elapsed = 0;
    this.applyFrame();
  }

  public pause(): void {
    this.playing = false;
  }

  private applyFrame(): void {
    const sprite = this.getComponent(Sprite);
    if (sprite && this.frames.length > 0) sprite.spriteFrame = this.frames[this.frameIndex];
  }
}
