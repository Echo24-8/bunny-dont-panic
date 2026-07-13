export class ObjectPool {
  constructor(capacity, factory = () => ({})) {
    this.items = Array.from({ length: capacity }, (_, index) => ({ ...factory(), active: false, poolIndex: index }));
    this.free = Array.from({ length: capacity }, (_, index) => capacity - index - 1);
    this.activeCount = 0;
  }

  acquire(values = {}) {
    const index = this.free.pop();
    if (index === undefined) return null;
    const item = this.items[index];
    Object.assign(item, values, { active: true });
    this.activeCount += 1;
    return item;
  }

  release(item) {
    if (!item?.active) return false;
    item.active = false;
    this.free.push(item.poolIndex);
    this.activeCount -= 1;
    return true;
  }

  clear() {
    this.free.length = 0;
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      this.items[index].active = false;
      this.free.push(index);
    }
    this.activeCount = 0;
  }

  forEachActive(callback) {
    for (const item of this.items) if (item.active) callback(item);
  }

  findNearest(x, y, predicate = () => true) {
    let nearest = null;
    let nearestDistance = Infinity;
    this.forEachActive((item) => {
      if (!predicate(item)) return;
      const distance = (item.x - x) ** 2 + (item.y - y) ** 2;
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    });
    return nearest;
  }
}

