import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  view,
} from 'cc';
import {
  CASTLE,
  CELL_GAP,
  CELL_SIZE,
  CELL_STEP,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  GRID_X,
  GRID_Y,
  isBuildable,
  isCastleCell,
  OPENING_SHOP,
  PREPARATION_SHIFT,
  ShopDefinition,
  STAGE2_MAP,
} from './sim/Stage2Config.ts';
import { SpriteSequence } from './view/SpriteSequence.ts';

const { ccclass } = _decorator;

interface DragState {
  node: Node;
  definition: ShopDefinition;
  home: Vec3;
}

@ccclass('ShouchengGame')
export class ShouchengGame extends Component {
  private gridLayer!: Node;
  private shopLayer!: Node;
  private actorLayer!: Node;
  private mapData = STAGE2_MAP.slice();
  private occupied = new Set<string>();
  private treeNodes = new Map<string, Node>();
  private treeClearCount = 0;
  private money = 0;
  private drag: DragState | null = null;
  private fighting = false;
  private wave = 1;
  private waveLabel!: Label;

  public async onLoad(): Promise<void> {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
    this.node.name = 'ShouchengCanvas';
    await this.buildPreparationScene();
  }

  private async buildPreparationScene(): Promise<void> {
    const backgroundLayer = this.makeLayer('Background');
    this.gridLayer = this.makeLayer('StageGrid');
    this.actorLayer = this.makeLayer('Actors');
    this.shopLayer = this.makeLayer('BattleShop');
    await this.addSprite(backgroundLayer, 'original/maps/Map_Forest', 0, -PREPARATION_SHIFT, 750, 1623);
    this.buildGrid();
    await this.buildTrees();
    await this.buildCastle();
    await this.buildHud();
    await this.buildShop();
  }

  private makeLayer(name: string): Node {
    const layer = new Node(name);
    layer.layer = this.node.layer;
    layer.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(layer);
    return layer;
  }

  private topLeftPosition(x: number, y: number, width: number, height: number): Vec3 {
    return new Vec3(x + width / 2 - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - y - height / 2, 0);
  }

  private localToTopLeft(position: Vec3): { x: number; y: number } {
    return { x: position.x + DESIGN_WIDTH / 2, y: DESIGN_HEIGHT / 2 - position.y };
  }

  private buildGrid(): void {
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        if (this.mapData[row][column] === 'o') continue;
        const x = GRID_X + column * CELL_STEP;
        const y = GRID_Y + row * CELL_STEP;
        this.addRect(this.gridLayer, `Floor_${column}_${row}`, x, y, CELL_SIZE, CELL_SIZE, new Color(130, 210, 85, 62), new Color(201, 242, 161, 150));
      }
    }
  }

  private async buildTrees(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        if (this.mapData[row][column] !== '2') continue;
        tasks.push(this.addTree(column, row));
      }
    }
    await Promise.all(tasks);
  }

  private async addTree(column: number, row: number): Promise<void> {
    const x = GRID_X + column * CELL_STEP + 10;
    const y = GRID_Y + row * CELL_STEP + 3;
    const node = await this.addSprite(this.gridLayer, 'original/ui/tree', x, y, 72, 86);
    node.name = `Tree_${column}_${row}`;
    await this.addChildSprite(node, 'original/ui/money', -20, 17, 38, 38);
    this.addChildLabel(node, '0', 12, 16.5, 34, 43, 22, Color.WHITE);
    const key = `${column}_${row}`;
    this.treeNodes.set(key, node);
    node.on(Node.EventType.TOUCH_END, () => this.tryClearTree(column, row));
  }

  private tryClearTree(column: number, row: number): void {
    if (this.fighting) return;
    const key = `${column}_${row}`;
    const node = this.treeNodes.get(key);
    if (!node) return;
    const prices = [0, 1, 2, 3, 4, 5];
    const price = prices[Math.min(this.treeClearCount, prices.length - 1)];
    if (this.money < price) return;
    this.money -= price;
    this.treeClearCount += 1;
    this.mapData[row] = this.replaceCell(this.mapData[row], column, '1');
    node.destroy();
    this.treeNodes.delete(key);
  }

  private replaceCell(row: string, column: number, value: string): string {
    return `${row.slice(0, column)}${value}${row.slice(column + 1)}`;
  }

  private async buildCastle(): Promise<void> {
    const x = GRID_X + CASTLE.column * CELL_STEP - 18;
    const y = GRID_Y + CASTLE.row * CELL_STEP - 12;
    const width = CASTLE.width * CELL_STEP - CELL_GAP + 35;
    const height = CASTLE.height * CELL_STEP - CELL_GAP + 23;
    const castle = await this.addSprite(this.gridLayer, 'original/buildings/Building_MainBase1', x, y, width, height);
    castle.name = 'Building_MainBase';
    const hpY = Math.min(1005, Math.max(820, GRID_Y + (CASTLE.row + 2) * CELL_STEP - 31));
    await this.addSprite(this.gridLayer, 'original/ui/home_hp_bar_bg', 304, hpY, 143, 23);
    await this.addSprite(this.gridLayer, 'original/ui/home_hp_bar', 308, hpY + 4, 135, 15);
  }

  private async buildHud(): Promise<void> {
    const hud = this.makeLayer('HUD');
    await this.addSprite(hud, 'original/ui/hud_pause', 42, 50, 58, 58);
    this.waveLabel = this.addLabel(hud, '波次 1/5', 250, 43, 250, 58, 32, Color.WHITE);
    await this.addSprite(hud, 'original/ui/hud_progress_bg', 42, 109, 666, 17);
  }

  private async buildShop(): Promise<void> {
    await this.addSprite(this.shopLayer, 'original/ui/shop_panel', 0, 957, 750, 347);
    const slotX = [150, 285, 438];
    await Promise.all(OPENING_SHOP.map(async (definition, index) => {
      const node = await this.addSprite(this.shopLayer, definition.sprite, slotX[index], 970, 180, 160, true);
      node.name = `Shop_${definition.id}`;
      this.enableDrag(node, definition);
    }));
    await this.addButton(this.shopLayer, '刷新\n必出2级装备', 'original/ui/button_blue', 35, 1177, 215, 89, () => undefined, 23);
    await this.addButton(this.shopLayer, '刷新', 'original/ui/button_green', 267, 1177, 215, 89, () => undefined, 31);
    await this.addButton(this.shopLayer, '开战', 'original/ui/button_orange', 499, 1177, 215, 89, () => void this.startFight(), 34);
  }

  private enableDrag(node: Node, definition: ShopDefinition): void {
    node.on(Node.EventType.TOUCH_START, () => {
      if (this.fighting) return;
      this.drag = { node, definition, home: node.position.clone() };
      node.setSiblingIndex(node.parent?.children.length ?? 0);
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      if (!this.drag || this.drag.node !== node) return;
      const ui = event.getUILocation();
      const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x, ui.y));
      node.setPosition(local);
    });
    node.on(Node.EventType.TOUCH_END, () => this.finishDrag());
    node.on(Node.EventType.TOUCH_CANCEL, () => this.finishDrag());
  }

  private finishDrag(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const point = this.localToTopLeft(drag.node.position);
    const column = Math.round((point.x - GRID_X - CELL_SIZE / 2) / CELL_STEP);
    const row = Math.round((point.y - GRID_Y - CELL_SIZE / 2) / CELL_STEP);
    const valid = drag.definition.shape.every(([offsetX, offsetY]) => {
      const cellColumn = column + offsetX;
      const cellRow = row + offsetY;
      return isBuildable(this.mapData, cellColumn, cellRow)
        && !this.occupied.has(`${cellColumn}_${cellRow}`)
        && !isCastleCell(cellColumn, cellRow);
    });
    if (!valid) {
      drag.node.setPosition(drag.home);
      return;
    }
    drag.definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    drag.node.removeFromParent();
    this.gridLayer.addChild(drag.node);
    const naturalWidth = drag.node.getComponent(UITransform)?.contentSize.width ?? CELL_SIZE;
    const naturalHeight = drag.node.getComponent(UITransform)?.contentSize.height ?? CELL_SIZE;
    const footprintWidth = Math.max(CELL_SIZE, drag.definition.shape.reduce((max, cell) => Math.max(max, cell[0] + 1), 1) * CELL_STEP - CELL_GAP);
    const footprintHeight = Math.max(CELL_SIZE, drag.definition.shape.reduce((max, cell) => Math.max(max, cell[1] + 1), 1) * CELL_STEP - CELL_GAP);
    const x = GRID_X + column * CELL_STEP + (footprintWidth - naturalWidth) / 2;
    const y = GRID_Y + row * CELL_STEP + footprintHeight - naturalHeight;
    drag.node.setPosition(this.topLeftPosition(x, y, naturalWidth, naturalHeight));
    drag.node.off(Node.EventType.TOUCH_START);
    drag.node.off(Node.EventType.TOUCH_MOVE);
    drag.node.off(Node.EventType.TOUCH_END);
    drag.node.off(Node.EventType.TOUCH_CANCEL);
  }

  private async startFight(): Promise<void> {
    if (this.fighting) return;
    this.fighting = true;
    this.shopLayer.active = false;
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    this.actorLayer.setPosition(0, 0);
    for (const node of this.treeNodes.values()) {
      for (const child of node.children) child.active = false;
    }
    this.waveLabel.string = `波次 ${this.wave}/5`;
    await Promise.all([150, 285, 438].map((x, index) => this.spawnEnemy(x, 70 + index * 25, index % 2 === 0 ? 'Swordsman1' : 'Shooter1')));
  }

  private async spawnEnemy(x: number, y: number, body: 'Swordsman1' | 'Shooter1'): Promise<void> {
    const node = new Node(`Enemy_${body}`);
    node.layer = this.node.layer;
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.RAW;
    node.setScale(0.9, 0.9, 1);
    node.setPosition(this.topLeftPosition(x, y, 80, 100));
    this.actorLayer.addChild(node);
    const paths = Array.from({ length: 10 }, (_, frame) => `original/units/units-red/${body}_move_${frame}`);
    const frames = (await Promise.all(paths.map((path) => this.loadSpriteFrame(path).catch(() => null))))
      .filter((frame): frame is SpriteFrame => frame !== null);
    node.addComponent(SpriteSequence).play(frames);
  }

  private addRect(parent: Node, name: string, x: number, y: number, width: number, height: number, fill: Color, stroke: Color): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(this.topLeftPosition(x, y, width, height));
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    graphics.strokeColor = stroke;
    graphics.lineWidth = 2;
    graphics.rect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
    graphics.stroke();
    parent.addChild(node);
    return node;
  }

  private addLabel(parent: Node, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
    const node = new Node(`Label_${text}`);
    node.layer = this.node.layer;
    node.setPosition(this.topLeftPosition(x, y, width, height));
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.max(fontSize + 4, Math.floor(height / Math.max(1, text.split('\n').length)));
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = new Color(36, 26, 12, 255);
    label.outlineWidth = Math.max(1, Math.round(fontSize * 0.075));
    parent.addChild(node);
    return label;
  }

  private addChildLabel(parent: Node, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
    const node = new Node(`Label_${text}`);
    node.layer = this.node.layer;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = height;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = new Color(36, 26, 12, 255);
    label.outlineWidth = 2;
    parent.addChild(node);
    return label;
  }

  private async addChildSprite(parent: Node, path: string, x: number, y: number, width: number, height: number): Promise<Node> {
    const frame = await this.loadSpriteFrame(path);
    const node = new Node(path.split('/').pop() ?? 'Sprite');
    node.layer = this.node.layer;
    node.setPosition(x, y);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    node.addComponent(UITransform).setContentSize(width, height);
    parent.addChild(node);
    return node;
  }

  private async addButton(parent: Node, text: string, spritePath: string, x: number, y: number, width: number, height: number, handler: () => void, fontSize: number): Promise<Node> {
    const button = await this.addSprite(parent, spritePath, x, y, width, height);
    this.addLabel(button, text, 0, 0, width, height, fontSize, Color.WHITE).node.setPosition(0, 0);
    button.on(Node.EventType.TOUCH_END, handler);
    return button;
  }

  private async addSprite(parent: Node, path: string, x: number, y: number, width: number, height: number, keepAspect = false): Promise<Node> {
    const frame = await this.loadSpriteFrame(path);
    const node = new Node(path.split('/').pop() ?? 'Sprite');
    node.layer = this.node.layer;
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const transform = node.addComponent(UITransform);
    let outputWidth = width;
    let outputHeight = height;
    if (keepAspect) {
      const rect = frame.rect;
      const scale = Math.min(1, width / rect.width, height / rect.height);
      outputWidth = rect.width * scale;
      outputHeight = rect.height * scale;
    }
    transform.setContentSize(outputWidth, outputHeight);
    node.setPosition(this.topLeftPosition(x + (width - outputWidth) / 2, y + (height - outputHeight), outputWidth, outputHeight));
    parent.addChild(node);
    return node;
  }

  private loadSpriteFrame(path: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
      resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error || !frame) reject(error ?? new Error(`Missing SpriteFrame: ${path}`));
        else resolve(frame);
      });
    });
  }
}
