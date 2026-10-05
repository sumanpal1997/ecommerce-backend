import mongoose, { Types } from 'mongoose';
import { dbConnection } from '../infrastructure/database/mongoose.connection';
import { CategoryModel } from '../modules/catalog/category.model';
import { ProductModel } from '../modules/catalog/product.model';
import { InventoryModel } from '../modules/inventory/inventory.model';
import { UserModel } from '../modules/users/user.model';
import { CartModel } from '../modules/cart/cart.model';
import { OrderModel } from '../modules/orders/order.model';
import { PaymentModel } from '../modules/payments/payment.model';
import { PasswordUtil } from '../modules/auth/utils/password.util';
import { productService } from '../modules/catalog/product.service';

/**
 * Idempotent Database Seeder.
 * Populates categories, products, inventory records, and test credentials.
 */
async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding script...');

  try {
    await dbConnection.connect();
    console.log('Connected to database for seeding.');

    // 1. Clear existing collections
    console.log('Clearing old collections...');
    await Promise.all([
      CategoryModel.deleteMany({}),
      ProductModel.deleteMany({}),
      InventoryModel.deleteMany({}),
      UserModel.deleteMany({}),
      CartModel.deleteMany({}),
      OrderModel.deleteMany({}),
      PaymentModel.deleteMany({}),
    ]);
    console.log('Collections cleared.');

    // 2. Seed Users
    console.log('Seeding administrative and customer accounts...');
    const defaultPasswordHash = await PasswordUtil.hash('Password123!');

    const adminUser = await UserModel.create({
      email: 'admin@shopflow.dev',
      passwordHash: defaultPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
      addresses: [],
    });

    const customerUser = await UserModel.create({
      email: 'customer@shopflow.dev',
      passwordHash: defaultPasswordHash,
      firstName: 'Alex',
      lastName: 'Rivera',
      role: 'CUSTOMER',
      isActive: true,
      addresses: [
        {
          street: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          postalCode: '97477',
          country: 'United States',
          isDefault: true,
        },
      ],
    });
    console.log(`Created users: Admin (${adminUser.email}) and Customer (${customerUser.email}).`);

    // 3. Seed Hierarchical Categories
    console.log('Seeding category taxonomy with materialized paths...');

    // Root categories
    const electronics = await CategoryModel.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Cutting-edge gadgets, computing devices, and audio equipment',
      parentId: null,
      path: '/electronics',
      level: 0,
      isActive: true,
    });

    const apparel = await CategoryModel.create({
      name: 'Apparel',
      slug: 'apparel',
      description: 'Modern fashion, activewear, and designer accessories',
      parentId: null,
      path: '/apparel',
      level: 0,
      isActive: true,
    });

    const home = await CategoryModel.create({
      name: 'Home & Living',
      slug: 'home',
      description: 'Ergonomic furnishings, kitchen appliances, and living essentials',
      parentId: null,
      path: '/home',
      level: 0,
      isActive: true,
    });

    // Subcategories under Electronics
    const audio = await CategoryModel.create({
      name: 'Audio & Headphones',
      slug: 'audio',
      description: 'Noise-canceling headphones, earbuds, and premium sound systems',
      parentId: electronics._id,
      path: '/electronics/audio',
      level: 1,
      isActive: true,
    });

    const computers = await CategoryModel.create({
      name: 'Computers & Laptops',
      slug: 'computers',
      description: 'High-performance workstations, ultrabooks, and accessories',
      parentId: electronics._id,
      path: '/electronics/computers',
      level: 1,
      isActive: true,
    });

    const wearables = await CategoryModel.create({
      name: 'Wearables & Smartwatches',
      slug: 'wearables',
      description: 'Fitness trackers, titanium smartwatches, and telemetry gear',
      parentId: electronics._id,
      path: '/electronics/wearables',
      level: 1,
      isActive: true,
    });

    // Subcategories under Apparel
    const mensWear = await CategoryModel.create({
      name: "Men's Apparel",
      slug: 'mens-wear',
      description: 'Tech fleece outerwear, performance shirts, and tailored essentials',
      parentId: apparel._id,
      path: '/apparel/mens-wear',
      level: 1,
      isActive: true,
    });

    const womensWear = await CategoryModel.create({
      name: "Women's Apparel",
      slug: 'womens-wear',
      description: 'Activewear tights, hoodies, and lifestyle clothing',
      parentId: apparel._id,
      path: '/apparel/womens-wear',
      level: 1,
      isActive: true,
    });

    const footwear = await CategoryModel.create({
      name: 'Footwear & Sneakers',
      slug: 'footwear',
      description: 'Running shoes, lifestyle sneakers, and slip-resistant footwear',
      parentId: apparel._id,
      path: '/apparel/footwear',
      level: 1,
      isActive: true,
    });

    // Subcategories under Home
    const kitchen = await CategoryModel.create({
      name: 'Kitchen Appliances',
      slug: 'kitchen',
      description: 'Espresso machines, precision cookers, and culinary gear',
      parentId: home._id,
      path: '/home/kitchen',
      level: 1,
      isActive: true,
    });

    const office = await CategoryModel.create({
      name: 'Office & Furniture',
      slug: 'office',
      description: 'Ergonomic task chairs, motorized standing desks, and lighting',
      parentId: home._id,
      path: '/home/office',
      level: 1,
      isActive: true,
    });

    console.log('Seeded 11 category taxonomy nodes.');

    // 4. Seed Products
    console.log('Seeding realistic product catalog with attributes and prices...');

    const productsSeedData = [
      {
        title: 'Sony WH-1000XM5 Wireless Noise-Canceling Headphones',
        slug: 'sony-wh-1000xm5-wireless-headphones',
        description:
          'Industry-leading active noise canceling with two processors and 8 microphones for unprecedented call quality and immersion. Features 30-hour battery life and ultra-comfortable lightweight design.',
        brand: 'Sony',
        categoryId: audio._id,
        sku: 'SNY-WH1000XM5-BLK',
        basePrice: 399.99,
        salePrice: 349.99,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
            alt: 'Sony WH-1000XM5 Wireless Headphones in Midnight Black',
            isPrimary: true,
          },
          {
            url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
            alt: 'Sony Headphones on stand',
            isPrimary: false,
          },
        ],
        attributes: {
          Color: 'Midnight Black',
          Connectivity: 'Bluetooth 5.2',
          'Battery Life': '30 Hours',
          Weight: '250g',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.8,
        ratingCount: 124,
        stock: 50,
      },
      {
        title: 'Apple AirPods Max Wireless Over-Ear Headphones',
        slug: 'apple-airpods-max-silver',
        description:
          'High-fidelity audio engineered with an Apple-designed dynamic driver, computational audio via H1 chips, and best-in-class Active Noise Cancellation with Transparency mode.',
        brand: 'Apple',
        categoryId: audio._id,
        sku: 'APL-AIRPODS-MAX-SLV',
        basePrice: 549.0,
        salePrice: 499.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
            alt: 'Apple AirPods Max Silver Headband and Canopy',
            isPrimary: true,
          },
        ],
        attributes: {
          Color: 'Silver',
          Chip: 'Apple H1 (Each Ear Cup)',
          Audio: 'Spatial Audio with Dynamic Head Tracking',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.7,
        ratingCount: 89,
        stock: 35,
      },
      {
        title: 'Apple MacBook Pro 16" M3 Max Workstation',
        slug: 'apple-macbook-pro-16-m3-max',
        description:
          'Pro power unchained. Features the breakthrough Apple M3 Max 16-core CPU, 40-core GPU, 36GB unified memory, and Liquid Retina XDR display with up to 22 hours of battery endurance.',
        brand: 'Apple',
        categoryId: computers._id,
        sku: 'APL-MBP16-M3MAX',
        basePrice: 3499.0,
        salePrice: 3299.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
            alt: 'MacBook Pro Retina Display open on modern desk',
            isPrimary: true,
          },
        ],
        attributes: {
          Processor: 'Apple M3 Max (16-Core)',
          Memory: '36GB Unified RAM',
          Storage: '1TB Superfast NVMe SSD',
          Display: '16.2 inch Liquid Retina XDR',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.9,
        ratingCount: 45,
        stock: 20,
      },
      {
        title: 'Dell XPS 15 InfinityEdge OLED Laptop',
        slug: 'dell-xps-15-oled-laptop',
        description:
          'Striking balance of power and portability. 13th Gen Intel Core i9-13900H, NVIDIA GeForce RTX 4070 8GB GDDR6, and breathtaking 3.5K OLED touchscreen with 100% DCI-P3 color gamut.',
        brand: 'Dell',
        categoryId: computers._id,
        sku: 'DEL-XPS15-OLED',
        basePrice: 2299.99,
        salePrice: 1999.99,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
            alt: 'Dell XPS 15 premium aluminum laptop',
            isPrimary: true,
          },
        ],
        attributes: {
          Screen: '15.6 inch 3.5K (3456x2160) OLED Touch',
          CPU: 'Intel Core i9-13900H (14-Core)',
          GPU: 'NVIDIA GeForce RTX 4070 8GB',
          Memory: '32GB DDR5 4800MHz',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.6,
        ratingCount: 62,
        stock: 25,
      },
      {
        title: 'Apple Watch Ultra 2 GPS + Cellular 49mm',
        slug: 'apple-watch-ultra-2-titanium',
        description:
          'The most capable and rugged Apple Watch ever. Corrosion-resistant titanium case, precision dual-frequency GPS, up to 36 hours of battery life, and a 3,000-nit Always-On display.',
        brand: 'Apple',
        categoryId: wearables._id,
        sku: 'APL-WATCH-ULTRA2',
        basePrice: 799.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
            alt: 'Apple Watch Ultra titanium case and orange ocean loop',
            isPrimary: true,
          },
        ],
        attributes: {
          Case: '49mm Aerospace-Grade Titanium',
          Display: '3000 nits Sapphire Crystal',
          'Water Resistance': '100m Dive Rated (EN13319)',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.9,
        ratingCount: 110,
        stock: 40,
      },
      {
        title: 'Nike Sportswear Tech Fleece Full-Zip Windrunner',
        slug: 'nike-tech-fleece-full-zip-windrunner',
        description:
          'Smooth on both sides, Tech Fleece offers premium warmth and an elevated look without adding bulk. Chevron design lines nod to the heritage 1978 Windrunner track jacket.',
        brand: 'Nike',
        categoryId: mensWear._id,
        sku: 'NKE-TECH-HOODIE-GRY',
        basePrice: 145.0,
        salePrice: 119.99,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80',
            alt: 'Nike Tech Fleece athletic jacket',
            isPrimary: true,
          },
        ],
        attributes: {
          Material: '66% Cotton / 34% Polyester',
          Fit: 'Standard athletic fit',
          Color: 'Dark Heather Grey / Black',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.7,
        ratingCount: 215,
        stock: 60,
      },
      {
        title: 'Nike Air Max 270 Lifestyle Running Sneakers',
        slug: 'nike-air-max-270-sneakers',
        description:
          "Nike's first lifestyle Air unit delivers energy and cushion with every step. Boasts a super-tall Max Air 270 heel unit and lightweight knit upper for breathability and modern streetwear flair.",
        brand: 'Nike',
        categoryId: footwear._id,
        sku: 'NKE-AM270-WHT-10',
        basePrice: 160.0,
        salePrice: 129.99,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
            alt: 'Nike red and white sports sneaker',
            isPrimary: true,
          },
        ],
        attributes: {
          Size: 'US 10 (Men)',
          Sole: 'Max Air 270 heel unit + dual-density foam',
          Color: 'Sport Red / Pure Platinum',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.8,
        ratingCount: 340,
        stock: 45,
      },
      {
        title: 'Lululemon Align High-Rise Pant 25" Yoga Tights',
        slug: 'lululemon-align-high-rise-pant-25',
        description:
          "When feeling nothing is everything. Powered by Nulu fabric, the Align collection feels weightless, buttery-soft, and stretches effortlessly with every yoga pose and workout routine.",
        brand: 'Lululemon',
        categoryId: womensWear._id,
        sku: 'LLL-ALIGN-25-BLK',
        basePrice: 98.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=800&auto=format&fit=crop&q=80',
            alt: 'Black high-rise athletic leggings',
            isPrimary: true,
          },
        ],
        attributes: {
          Fabric: 'Nulu (Weightless & Buttery Soft)',
          Rise: 'High Rise',
          Inseam: '25 inches',
          Color: 'Black',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.9,
        ratingCount: 480,
        stock: 75,
      },
      {
        title: 'Patagonia Men’s Nano Puff Insulated Jacket',
        slug: 'patagonia-nano-puff-jacket',
        description:
          'Warm, windproof, water-resistant. The Nano Puff uses lightweight 60g PrimaLoft Gold Insulation Eco with 100% postconsumer recycled polyester for supreme backcountry thermal efficiency.',
        brand: 'Patagonia',
        categoryId: mensWear._id,
        sku: 'PAT-NANOPUFF-NVY-L',
        basePrice: 239.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=800&auto=format&fit=crop&q=80',
            alt: 'Navy blue insulated puffer jacket',
            isPrimary: true,
          },
        ],
        attributes: {
          Insulation: '60g PrimaLoft Gold Insulation Eco',
          Shell: '100% Recycled Polyester Ripstop',
          Size: 'Large',
          Color: 'Classic Navy',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.8,
        ratingCount: 190,
        stock: 30,
      },
      {
        title: 'Breville the Barista Touch Espresso Machine',
        slug: 'breville-barista-touch-espresso-machine',
        description:
          'Commercial performance in a compact footprint. Automated touchscreen display simplifies how to make your favorite cafe coffee in 3 easy steps: Grind, Brew, and Milk. Heats up in 3 seconds.',
        brand: 'Breville',
        categoryId: kitchen._id,
        sku: 'BRV-BES880BSS',
        basePrice: 999.95,
        salePrice: 899.95,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
            alt: 'Brushed stainless steel Breville espresso machine',
            isPrimary: true,
          },
        ],
        attributes: {
          Heating: 'ThermoJet 3-Second Fast Start',
          Pump: '15 Bar Italian Pump',
          Display: 'Intuitive Touchscreen with Pre-Programmed Cafes',
          Material: 'Brushed Stainless Steel',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.9,
        ratingCount: 155,
        stock: 15,
      },
      {
        title: 'Herman Miller Aeron Ergonomic Office Task Chair',
        slug: 'herman-miller-aeron-chair-size-b',
        description:
          'The benchmark for ergonomic seating. Features Pellicle 8Z elastomeric suspension that distributes body weight evenly, eliminates pressure points, and circulates air for full-day support.',
        brand: 'Herman Miller',
        categoryId: office._id,
        sku: 'HM-AERON-SIZE-B',
        basePrice: 1695.0,
        salePrice: 1495.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80',
            alt: 'Herman Miller Aeron ergonomic desk chair in graphite',
            isPrimary: true,
          },
        ],
        attributes: {
          Size: 'Size B (Medium)',
          Suspension: '8Z Pellicle Breathable Mesh',
          PostureFit: 'Dual PostureFit SL Lumbar Support',
          Warranty: '12-Year Herman Miller Manufacturer Warranty',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.9,
        ratingCount: 310,
        stock: 12,
      },
      {
        title: 'Bose SoundLink Revolve+ II 360 Bluetooth Speaker',
        slug: 'bose-soundlink-revolve-plus-ii',
        description:
          'Deep, loud, and immersive 360-degree acoustic coverage. Seamless aluminum body with IP55 water and dust resistance, integrated fabric handle, and up to 17 hours of battery playback.',
        brand: 'Bose',
        categoryId: audio._id,
        sku: 'BOS-REVOLVE-PLUS-BLK',
        basePrice: 329.0,
        salePrice: 279.0,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80',
            alt: 'Bose cylindrical 360 portable speaker',
            isPrimary: true,
          },
        ],
        attributes: {
          Acoustics: 'True 360-Degree Sound Dispenser',
          Durability: 'IP55 Water & Dust Resistant',
          Battery: '17-Hour Rechargeable Lithium-ion',
          Color: 'Triple Black',
        },
        status: 'ACTIVE' as const,
        ratingAverage: 4.7,
        ratingCount: 88,
        stock: 40,
      },
    ];

    // Insert Products and corresponding Inventory records
    for (const prodData of productsSeedData) {
      const { stock, ...productFields } = prodData;

      const productDoc = await ProductModel.create(productFields);

      // Create dedicated inventory bucket in inventories collection
      await InventoryModel.create({
        productId: productDoc._id,
        sku: productDoc.sku,
        availableStock: stock,
        reservedStock: 0,
        lowStockThreshold: 5,
      });

      console.log(`  ✓ Seeded "${productDoc.title}" (SKU: ${productDoc.sku}, Stock: ${stock})`);
    }

    console.log(`Seeded ${productsSeedData.length} products and synchronized inventory records.`);

    // 5. Pre-warm In-Memory Trie Autocomplete
    console.log('Pre-warming in-memory Autocomplete Trie from newly seeded catalog...');
    await productService.warmTrie();
    const suggestions = productService.autocomplete('son');
    console.log(`Trie test search for "son": found ${suggestions.length} items (${suggestions.map((s) => s.term).join(', ')})`);

    console.log('\n🎉 Database seeding finished successfully!');
    console.log('───────────────────────────────────────────────────────');
    console.log('Default Credentials for Testing:');
    console.log('  Admin:    admin@shopflow.dev    / Password123!');
    console.log('  Customer: customer@shopflow.dev / Password123!');
    console.log('───────────────────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    process.exit(1);
  } finally {
    await dbConnection.disconnect();
    console.log('Database connection closed.');
    process.exit(0);
  }
}

// Execute seeder
seedDatabase();
