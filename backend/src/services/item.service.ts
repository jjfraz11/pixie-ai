import { Application, Params, Service, NullableId } from '@feathersjs/feathers';

// Define the resource type
interface Item {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define data types for operations
type ItemData = Partial<Item>;
type ItemPatch = Partial<ItemData>;

// Simple in-memory storage for demonstration
let items: Item[] = [];
let idCounter = 0;

class ItemService {
  app: Application;

  constructor(options: any, app: Application) {
    this.app = app;
  }

  async find(params?: Params): Promise<Item[]> {
    return items;
  }

  async get(id: string, params?: Params): Promise<Item> {
    const item = items.find((i) => i.id === id);
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  }

  async create(data: ItemData, params?: Params): Promise<Item> {
    const newItem = {
      id: (++idCounter).toString(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Item;
    items.push(newItem);
    return newItem;
  }

  async update(id: NullableId, data: ItemPatch, params?: Params): Promise<Item> {
    if (!id) {
      throw new Error('Missing id.');
    }

    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error('Item not found');
    }
    items[index] = { ...items[index], ...data, updatedAt: new Date() };
    return items[index];
  }

  async patch(id: NullableId, data: ItemPatch, params?: Params): Promise<Item> {
    if (!id) {
      throw new Error('Missing id.');
    }

    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error('Item not found');
    }
    items[index] = { ...items[index], ...data, updatedAt: new Date() };
    return items[index];
  }

  async remove(id: NullableId, params?: Params): Promise<Item> {
    if (!id) {
      throw new Error('Missing id.');
    }

    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error('Item not found');
    }
    const removedItem = items.splice(index, 1)[0];
    return removedItem;
  }
}

// Function to configure the service
export default function configureItemService(app: Application) {
  app.use('/items', new ItemService({}, app));
}
