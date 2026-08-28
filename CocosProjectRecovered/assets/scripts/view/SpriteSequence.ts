import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass } = _decorator;

@ccclass('SpriteSequence')
export class SpriteSequence extends Component {
  private frames: SpriteFrame[] = [];
  private intervalSeconds = 0.102;
  private elapsed = 0;
  private frameIndex = 0;

  public play(frames: SpriteFrame[], intervalSeconds = 0.102): void {
    this.frames = frames;
    this.intervalSeconds = intervalSeconds;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.applyFrame();
  }

  public update(deltaTime: number): void {
    if (this.frames.length < 2) return;
    this.elapsed += deltaTime;
    while (this.elapsed >= this.intervalSeconds) {
      this.elapsed -= this.intervalSeconds;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.applyFrame();
    }
  }

  private applyFrame(): void {
    const sprite = this.getComponent(Sprite);
    if (sprite && this.frames.length > 0) sprite.spriteFrame = this.frames[this.frameIndex];
  }
}
