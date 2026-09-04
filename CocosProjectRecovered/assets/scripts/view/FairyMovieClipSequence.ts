import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform } from 'cc';

const { ccclass } = _decorator;

export interface FairyMovieClipFrameLayout {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  addDelayMilliseconds: number;
}

@ccclass('FairyMovieClipSequence')
export class FairyMovieClipSequence extends Component {
  private frames: Array<SpriteFrame | null> = [];
  private layouts: FairyMovieClipFrameLayout[] = [];
  private intervalSeconds = 0.083;
  private elapsed = 0;
  private frameIndex = 0;
  private loop = false;
  private onComplete: (() => void) | null = null;
  private playing = false;
  private canvasWidth = 1;
  private canvasHeight = 1;
  private renderScale = 1;
  private frameNode: Node | null = null;

  public play(
    frames: Array<SpriteFrame | null>,
    layouts: FairyMovieClipFrameLayout[],
    canvasWidth: number,
    canvasHeight: number,
    intervalSeconds: number,
    loop: boolean,
    renderScale: number,
    onComplete?: () => void,
  ): void {
    if (frames.length !== layouts.length) throw new Error('FairyGUI MovieClip frame/layout count mismatch');
    this.frames = frames;
    this.layouts = layouts;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.intervalSeconds = intervalSeconds;
    this.loop = loop;
    this.renderScale = renderScale;
    this.onComplete = onComplete ?? null;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.playing = frames.length > 0;
    this.node.getComponent(UITransform)?.setContentSize(canvasWidth * renderScale, canvasHeight * renderScale);
    this.ensureFrameNode();
    this.applyFrame();
  }

  public update(deltaTime: number): void {
    if (!this.playing || this.frames.length < 2) return;
    this.elapsed += deltaTime;
    let duration = this.frameDuration(this.frameIndex);
    while (this.elapsed >= duration) {
      this.elapsed -= duration;
      const nextFrame = this.frameIndex + 1;
      if (nextFrame >= this.frames.length && !this.loop) {
        this.playing = false;
        const callback = this.onComplete;
        this.onComplete = null;
        callback?.();
        return;
      }
      this.frameIndex = nextFrame % this.frames.length;
      this.applyFrame();
      duration = this.frameDuration(this.frameIndex);
    }
  }

  private ensureFrameNode(): void {
    if (this.frameNode?.isValid) return;
    const frameNode = new Node('FairyMovieClipFrame');
    frameNode.layer = this.node.layer;
    frameNode.addComponent(UITransform);
    const sprite = frameNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.node.addChild(frameNode);
    this.frameNode = frameNode;
  }

  private frameDuration(index: number): number {
    return this.intervalSeconds + (this.layouts[index]?.addDelayMilliseconds ?? 0) / 1000;
  }

  private applyFrame(): void {
    if (!this.frameNode) return;
    const frame = this.frames[this.frameIndex] ?? null;
    const layout = this.layouts[this.frameIndex];
    const sprite = this.frameNode.getComponent(Sprite);
    const transform = this.frameNode.getComponent(UITransform);
    if (!sprite || !transform || !layout) return;
    sprite.enabled = frame !== null && layout.width > 0 && layout.height > 0;
    if (!sprite.enabled || !frame) return;
    sprite.spriteFrame = frame;
    transform.setContentSize(layout.width * this.renderScale, layout.height * this.renderScale);
    this.frameNode.setPosition(
      (layout.offsetX + layout.width / 2 - this.canvasWidth / 2) * this.renderScale,
      (this.canvasHeight / 2 - layout.offsetY - layout.height / 2) * this.renderScale,
    );
  }
}
