// Auto-generated static restaurant menus - scraped from DineOnCampus API
// and Maroon Meals data from https://dineoncampus.com/tamu/maroon-meals
// Generated on 2026-04-14

export type StaticMenuItem = {
  name: string;
  description?: string | null;
  portion?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type StaticMenuCategory = {
  name: string;
  items: StaticMenuItem[];
};

export type MaroonMealCombo = {
  name: string;
  value: number;
};

export type StaticRestaurantMenu = {
  categories: StaticMenuCategory[];
  maroonMeals?: {
    note: string;
    combos: MaroonMealCombo[];
  };
};

export const STATIC_RESTAURANT_MENUS: Record<string, StaticRestaurantMenu> = {
  '1876 Burgers - Sbisa Complex': {
    categories: [
      {
        name: 'Appetizers',
        items: [
          { name: 'Fried Jalapeno Bottlecaps', description: 'Served with Ranch Dipping Sauce', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Mozzarella Wedges', description: 'Served with Marinara Dipping Sauce', portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Fried Onion Rings', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Pickles', description: 'Served with Ranch Dipping Sauce', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Burgers & Dogs',
        items: [
          { name: 'BYO Double', description: 'Double Cheeseburger with your Toppings of Choice', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'BYO Single', description: 'Single Hamburger with your Toppings of Choice', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Double Aggie Classic', description: '2 Patties, Melted Cheese, Ketchup, Mustard, Pickles, and Onions', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Double Bacon Cheeseburger', description: 'Topped with Onions, Pickles, Ketchup, & Mustard', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Double Patty Melt', description: 'Double Cheeseburger, Secret Sauce, Caramelized Onions, and served on Texas Toast', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Footlong Chili Cheese Dog', description: 'Topped with Diced Onion, Shredded Cheddar, and Warm Chili', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Footlong Coney Dog', description: 'Topped with Mustard, Sauerkraut, Onions, Sweet Relish, and Bacon Bits', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Single Classic', description: 'Single Patty, Melted Cheese, Ketchup, Mustard, Pickles, and Onions', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Black Bean Burger', description: '2 Black Pean Patties, Melted Cheese, Ketchup, Pickles, & Onions', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Supreme Burger', description: 'Double Cheeseburger, Signature Sauce, Lettuce, Tomato, and Onion', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Yell Burger', description: 'Double Patty with Cheese, Lettuce, Pickles, Onions, and 1000 Island Dressing', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Chicken',
        items: [
          { name: 'Aggie Chicken Sandwich', description: 'Country breaded chicken breast patty topped with fried pickles and smothered with Aggie Sauce.', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Chicken Parmesan Sandwich', description: 'Country breaded chicken breast patty topped with fried mozzarella cheese wedges and marinara sauce inside a toasted bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chicken Tender Combo', description: '3 Chicken tenders with french fries, your dipping sauce of choice, and a fountain drink', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Deluxe Chicken Sandwich', description: 'Country breaded chicken breast patty with lettuce, tomato, and guacamole inside a toasted bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Chicken Sandwich', description: 'Country breaded chicken breast patty smothered in fresh ranch, buffalo sauce, and shaved lettuce inside of a toasted bun', portion: '—', calories: 650, protein: 28, carbs: 43, fat: 19 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'French Fries', description: 'Crispy salted shoestring fries', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Garlic Parmesan Fries', description: 'Shoestring fries tossed in Garlic Butter, Garlic Salt mix, and topped with Parmesan Cheese and Parsley', portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Nacho Fries', description: 'Shoestring French Fries smothered in Nacho Cheese', portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
        ],
      },
      {
        name: 'Desserts and Shakes',
        items: [
          { name: 'Milkshakes', description: 'Choose your favorite ice cream flavor for a creamy milkshake made with Hershey\'s Ice Cream', portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Root Beer Float', description: '2 scoops of Vanilla Ice Cream topped with cold Root Beer', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at 1876 Burgers include original fries and a medium fountain drink! Avoiding Gluten buns available.',
      combos: [
        { name: 'Double Aggie Classic Burger', value: 11.98 },
        { name: 'Double Patty Melt', value: 11.98 },
        { name: 'Supreme Burger', value: 11.98 },
        { name: 'Yell Burger', value: 11.98 },
        { name: 'Chicken Parm Sandwich', value: 11.98 },
        { name: 'Aggie Chicken Sandwich', value: 11.98 },
        { name: '1876 Deluxe Chicken Sandwich', value: 11.98 },
        { name: 'Spicy Buffalo Chicken Sandwich', value: 11.98 },
        { name: 'Classic Grilled Chicken Sandwich', value: 8.98 },
        { name: 'Black Bean Burger (Vegetarian)', value: 11.98 },
      ],
    },
  },
  'Chick-Fil-A - Sbisa Underground Food Court': {
    categories: [
      {
        name: 'Entrees',
        items: [
          { name: '12 ct Grilled Nuggets', description: 'Bite-sized pieces of freshly marinated boneless breast of chicken, grilled for a tender and juicy backyard-smoky taste.', portion: '12 Count', calories: 170, protein: 30, carbs: 50, fat: 30 },
          { name: '12 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '12 Count', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: '8 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '8 Count', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: '8 ct. Grilled Nuggets', description: 'Bite-sized pieces of freshly marinated boneless breast of chicken, grilled for a tender and juicy backyard-smoky taste.', portion: '8 Count', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-A® Chicken Sandwich', description: 'A boneless breast of chicken seasoned to perfection, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips.', portion: '1 each', calories: 440, protein: 29, carbs: 41, fat: 18 },
          { name: 'Chicken Sandwich', description: null, portion: '1 each', calories: 420, protein: 30, carbs: 50, fat: 30 },
          { name: 'Deluxe Sandwich', description: null, portion: '1 each', calories: 490, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Club Sandwich', description: null, portion: '1 each', calories: 520, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Sandwich', description: 'A lemon-herb marinated boneless breast of chicken, grilled for a tender and juicy backyard-smokey taste, served on a toasted Multigrain Brioche bun with Green Leaf lettuce and tomato.', portion: '1 each', calories: 380, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Nuggets', description: null, portion: '8 ct', calories: 130, protein: 30, carbs: 50, fat: 30 },
          { name: 'Nuggets', description: null, portion: '8 ct', calories: 250, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Chicken Sandwich', description: 'A boneless breast of chicken seasoned with a spicy blend of peppers, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips.', portion: '1 each', calories: 460, protein: 28, carbs: 43, fat: 19 },
          { name: 'Spicy Deluxe Sandwich', description: null, portion: '1 each', calories: 540, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Cobb Salad', description: null, portion: '1 each', calories: 690, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Market Salad', description: 'Grilled and sliced chicken breast served on a fresh bed of chopped Romaine lettuce and baby greens, topped with shredded red cabbage and carrots, crumbled blue cheese and a mix of red and green apples, strawberries and blueberries.', portion: '1 salad', calories: 200, protein: 30, carbs: 50, fat: 30 },
          { name: 'Market Salad', description: null, portion: '1 each', calories: 550, protein: 28, carbs: 41, fat: 31 },
          { name: 'Spicy Southwest Salad', description: null, portion: '1 each', calories: 680, protein: 33, carbs: 37, fat: 27 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Berry Parfait', description: null, portion: '1 each', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-a Sauce Flavored Waffle Potato Chips', description: null, portion: '1 each', calories: 210, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruit Cup', description: 'A nutritious fruit mix made with chopped pieces of red and green apples, mandarin orange segments, fresh strawberry slices, and blueberries, served chilled. Prepared fresh daily.', portion: 'Medium', calories: 60, protein: 30, carbs: 50, fat: 30 },
          { name: 'Kale Crunch Side', description: null, portion: '1 each', calories: 170, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mac & Cheese', description: null, portion: 'Medium', calories: 450, protein: 16, carbs: 29, fat: 29 },
          { name: 'Original Flavor Waffle Potato Chips', description: null, portion: '1 bag', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Side Salad', description: null, portion: '1 each', calories: 470, protein: 30, carbs: 50, fat: 30 },
          { name: 'Waffle Potato Fries', description: null, portion: 'Medium', calories: 420, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Treats',
        items: [
          { name: 'Chocolate Chunk Cookie', description: null, portion: '1 each', calories: 370, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Fudge Brownie', description: null, portion: '1 each', calories: 370, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Milkshake', description: null, portion: '1 each', calories: 600, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cookies & Cream Milkshake', description: null, portion: '1 each', calories: 630, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Coffee', description: null, portion: '1 each', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Lemonade', description: null, portion: '1 each', calories: 350, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Lemonade w/ Diet Lemonade', description: null, portion: '1 each', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Icedream Cone', description: null, portion: '1 each', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'Icedream Cup', description: null, portion: '1 each', calories: 140, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Milkshake', description: null, portion: '1 each', calories: 560, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Milkshake', description: null, portion: '1 each', calories: 580, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Chick-fil-A® Diet Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water. Diet Lemonade is sweetened with Splenda® No Calorie Sweetener.', portion: 'Medium', calories: 50, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-A® Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water.', portion: 'Medium', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Coffee', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'DASANI® Bottled Water', description: 'DASANI® combines the process of reverse osmosis filtration with a proprietary blend of minerals to create fresh, clean, and premium tasting water that is pure and delicious.', portion: '1 bottle', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Diet Lemonade', description: null, portion: 'Medium', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Freshly-Brewed Iced Tea Sweetened', description: 'Freshly-brewed each day from a blend of tea leaves. Available sweetened with real cane sugar.', portion: 'Medium', calories: 120, protein: 10, carbs: 30, fat: 10 },
          { name: 'Freshly-Brewed Iced Tea Unsweetened', description: 'Freshly-brewed each day from a blend of tea leaves. Available unsweetened.', portion: 'Medium', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Iced Coffee', description: null, portion: '—', calories: 200, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea Sweetened', description: null, portion: 'Medium', calories: 12, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea Unsweetened', description: null, portion: 'Medium', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Lemonade', description: null, portion: 'Medium', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sunjoy', description: null, portion: 'Medium', calories: 240, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Iced Coffee', description: null, portion: '—', calories: 200, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dipping Sauces',
        items: [
          { name: 'Barbecue Sauce', description: 'Barbecue Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Barbeque Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-A® Sauce', description: 'Chick-Fil-A Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-a Sauce', description: null, portion: '1 each', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Sauce', description: 'Garden Herb Ranch Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Ranch Sauce', description: null, portion: '1 each', calories: 100, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Mustard Sauce', description: 'Honey Mustard Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Roasted BBQ Sauce', description: 'Honey Roasted BBQ Sauce', portion: '1 packet', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Polynesian Sauce', description: 'Polynesian Sauce', portion: '1 packet', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sweet & Spicy Sriracha Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Buffalo Sauce', description: 'Buffalo Sauce', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dressings',
        items: [
          { name: 'Avocado Lime Ranch Dressing', description: null, portion: '1 each', calories: 310, protein: 10, carbs: 30, fat: 10 },
          { name: 'Creamy Salsa Dressing', description: null, portion: '1 each', calories: 290, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat Free Honey Mustard Dressing', description: 'Fat Free Honey Mustard Dressing', portion: '1 packet', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat-Free Honey Mustard Dressing', description: null, portion: '1 each', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Dressing', description: null, portion: '1 each', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Balsamic Vinaigrette Dressing', description: 'Light Balsamic Vinaigrette Dressing', portion: '1 packet', calories: 80, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Italian Dressing', description: 'Light Italian Dressing', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mayonnaise', description: 'creamy', portion: '1 Tbsp', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Apple Cider Vinaigrette Dressing', description: null, portion: '1 each', calories: 230, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!',
      combos: [
        { name: 'Original Chicken Sandwich', value: 9.49 },
        { name: 'Spicy Chicken Sandwich', value: 9.79 },
        { name: '8 Piece Chicken Nuggets', value: 9.59 },
        { name: 'Avoiding Gluten - Grilled Chicken Sandwich', value: 9.49 },
      ],
    },
  },
  'Copperhead Jack\'s - Sbisa Complex': {
    categories: [
      {
        name: 'Quesadillas',
        items: [
          { name: 'Diced Veggie Quesadilla', description: null, portion: '—', calories: 300, protein: 29, carbs: 41, fat: 18 },
          { name: 'Grilled Chicken Quesadilla', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Steak Quesadilla', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Tacos',
        items: [
          { name: 'Diced Veggie Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Steak Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Bowls',
        items: [
          { name: 'Diced Veggie Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Grilled Chicken Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Grilled Steak Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'MIni Bowls', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
        ],
      },
      {
        name: 'Burritos',
        items: [
          { name: 'Diced Veggie Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Steak Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chips and Guacamole', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Chips and Queso', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Chips and Salsa', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Tortillas', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Copperhead Jack\'s include the choice of a 16.9 oz bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Build Your Own Burrito', value: 11.48 },
        { name: 'Build Your Own Bowl', value: 11.98 },
      ],
    },
  },
  'Einstein Bros. Bagels - Sbisa Complex': {
    categories: [
      {
        name: 'Gourmet Bagels',
        items: [
          { name: 'Cheesy Hash Brown', description: 'Cheesy Hash Brown', portion: '1 Bagel', calories: 400, protein: 30, carbs: 50, fat: 30 },
          { name: 'Jalapeno Cheddar', description: 'Jalapeno Cheddar', portion: '1 bagel', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: 'Six-Cheese', description: 'Bagel', portion: '1 bagel', calories: 370, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Whipped Cream Cheese Shmear',
        items: [
          { name: 'Garden Veggie Reduced Fat', description: '25% less fat than our regular shmear', portion: '1.2 oz', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Garlic Herb Reduced Fat', description: '25% less fat than our regular shmear', portion: '1.2 oz', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Honey Almond Reduced Fat', description: 'Contains Almonds, 25% less fat than our regular shmear', portion: '1.2 oz', calories: 120, protein: 30, carbs: 50, fat: 30 },
          { name: 'Jalapeno Salsa Reduced Fat', description: '25% less fat than our regular shmear', portion: '1.2 oz', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Onion and Chive', description: 'Shmear', portion: '1.2 oz', calories: 120, protein: 30, carbs: 50, fat: 30 },
          { name: 'Plain', description: 'Shmear', portion: '1.2 oz', calories: 120, protein: 30, carbs: 50, fat: 30 },
          { name: 'Plain Reduced Fat', description: '25% less fat than our regular shmear', portion: '1.2 oz', calories: 100, protein: 30, carbs: 50, fat: 30 },
          { name: 'Smoked Salmon', description: 'Shmear', portion: '1.2 oz', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Reduced Fat', description: '25% less fat than our regular shmear', portion: '1.2 oz', calories: 120, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'EBB Barbeque Kettle Chip', description: 'EBB Barbeque Kettle Chip', portion: '1.2oz', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'EBB Jalapeno Kettle Chip', description: 'EBB Jalapeno Kettle Chip', portion: '1.2oz', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'EBB Original Kettle Chip', description: 'EBB Original Kettle Chip', portion: '1.2oz', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruit Cup', description: 'Fruit cup', portion: '4.0oz', calories: 50, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruit and Yogurt Parfait', description: 'Contains Almonds', portion: '10.5oz', calories: 200, protein: 30, carbs: 50, fat: 30 },
          { name: 'Greek Yogurt Parfait with Honey', description: 'Contains Almonds', portion: '7.2oz', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Twice Baked Hash Brown', description: null, portion: '1 ea', calories: 85, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Classic Egg Sandwiches',
        items: [
          { name: 'Applewood Bacon & Cheddar', description: 'Served with your choice of one egg or two (adds 90 Cal) on a plain bagel', portion: '6.1 oz', calories: 450, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cheddar Cheese', description: 'Served with your choice of one egg or two (adds 90 Cal) on a plain bagel', portion: '5.8 oz', calories: 410, protein: 30, carbs: 50, fat: 30 },
          { name: 'Ham & Swiss', description: 'Served with your choice of one egg or two (adds 90 Cal) on a plain bagel', portion: '7.3oz', calories: 450, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey Sausage & Cheddar', description: 'Served with your choice of one egg or two (adds 90 Cal) on a plain bagel', portion: '7.2oz', calories: 480, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Signature Sandwiches',
        items: [
          { name: 'Albacore Tuna Salad on Multigrain', description: 'Albacore Tuna, Celery and Mayo with Lettuce, Tomato, Red Onion on a Fresh-Baked Multigrain Roll', portion: '10oz', calories: 590, protein: 30, carbs: 50, fat: 30 },
          { name: 'Ham & Swiss', description: 'Smoked Ham, Lettuce, Tomato, Red Onion, Swiss Cheese with Mayo & Deli Mustard on a Fresh-Baked Potato Roll', portion: '11oz', calories: 660, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Veg Out on Multigrain', description: 'Hummus, Tomato, Red Onion, Spinach, Arugula, Roasted Red Peppers, Cucumber with Garden Veggie Shmear on a Fresh-Baked Multigrain Roll', portion: '10.5oz', calories: 460, protein: 30, carbs: 50, fat: 30 },
          { name: 'Nova Lox & Bagel', description: 'Nova Lox, Red Onion, Capers, Tomato with Plain Shmear on a Plan Bagel', portion: '9oz', calories: 480, protein: 30, carbs: 50, fat: 30 },
          { name: 'Tasty Turkey on Asiago Bagel', description: 'Roasted Turkey, spinach, cucumber, Lettuce, Tomato with Onion & chive Shmear on an Asiago Bagel', portion: '12oz', calories: 510, protein: 30, carbs: 50, fat: 30 },
          { name: 'Tuna salad, Without Bread Chioce', description: 'Albacore Tuna, Celery and Mayo with Lettuce, Tomato, Red Onion', portion: '7oz', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey & Cheddar', description: 'Roasted Turkey, Lettuce, Tomato, Red Onion, Cheddar Cheese with Mayo & Deli Mustard on a Fresh-Baked Potato Roll', portion: '11.3oz', calories: 660, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey, Bacon & Avocado', description: 'Roasted Turkey, Applewood Bacon, Avocado, Lettuce, Tomato with Roasted Tomato Spread on a Honey Whole Wheat Bagel', portion: '11.2oz', calories: 660, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Deli Sandwiches',
        items: [
          { name: 'Ham', description: null, portion: '11oz', calories: 510, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey Breast', description: null, portion: '11oz', calories: 470, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Grab and Go',
        items: [
          { name: 'Deli Ham Sandwich', description: null, portion: '8oz', calories: 370, protein: 30, carbs: 50, fat: 30 },
          { name: 'Roasted Turkey Sandwich', description: null, portion: '8oz', calories: 370, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Chicken Caesar', description: 'Chicken Caesar', portion: '10oz', calories: 340, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Chicken', description: 'fresh salad with strawberries, chicken and almonds', portion: '1 serving', calories: 330, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sweets',
        items: [
          { name: 'Blueberry Muffin', description: 'Blueberry Muffin', portion: '4.5oz', calories: 450, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Chip Coffee Cake', description: 'Chocolate Chip Coffee Cake', portion: '4.4oz', calories: 550, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Chip Muffin', description: 'Chocolate Chip Muffin', portion: '4.8oz', calories: 540, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Croissant Pastry', description: 'Chocolate Croissant Pastry', portion: '2.5oz', calories: 310, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cinnamon Chip Muffin', description: 'Cinnamon Chip Muffin', portion: '5.7oz', calories: 590, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cinnamon Twist', description: 'Cinnamon Twist', portion: '3.1oz', calories: 360, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cinnamon Twist Popper', description: 'Cinnamon Twist Popper', portion: '3.1oz', calories: 360, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cinnamon Walnut Strudel', description: 'Contains Walnuts', portion: '6oz', calories: 640, protein: 30, carbs: 50, fat: 30 },
          { name: 'Greek Cherry Yogurt Pastry', description: 'Cherry Pastry', portion: '3.8oz', calories: 380, protein: 30, carbs: 50, fat: 30 },
          { name: 'Heavenly Chocolate Chip Cookie', description: 'Chocolate Chunk Cookie', portion: '3.5oz', calories: 460, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mini Heavenly Chocolate Chip Cookie', description: 'Mini Chcolate Chunk Cookies', portion: '8.7oz', calories: 1150, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Bread Specialty',
        items: [
          { name: 'Ciabatta Bread', description: 'Ciabatta Bread', portion: '4oz', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Potato Roll', description: 'Potato roll', portion: '1 Roll', calories: 280, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Spreads',
        items: [
          { name: 'Butter Blend', description: 'Butter Blend', portion: '0.5oz', calories: 100, protein: 30, carbs: 50, fat: 30 },
          { name: 'Honey', description: 'Honey', portion: '1oz', calories: 90, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus', description: 'Hummus', portion: '1.5 oz', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Peanut Butter', description: 'Peanut Butter', portion: '1.5 oz', calories: 240, protein: 30, carbs: 50, fat: 30 },
          { name: 'Peanut Butter & Jelly', description: 'Peanut Butter & Jelly', portion: '2.5 oz', calories: 320, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Jelly', description: 'Natural Strawberry Jelly', portion: '1 oz', calories: 70, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Classic Bagels',
        items: [
          { name: 'Cinnamon Raisin', description: 'Cinnamon Raisin', portion: '1 bagel', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Everything', description: 'Everything Bagel', portion: '1 bagel', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Garlic', description: 'Garlic', portion: '1 bagel', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Honey Whole Wheat', description: 'Honey Whole Wheat', portion: '1 bagel', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Onion', description: 'Onion', portion: '1 bagel', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Plain', description: 'Plain', portion: '1 bagel', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Poppy', description: 'Poppy', portion: '1 bagel', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Sesame', description: 'Sesame', portion: '1 bagel', calories: 290, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Hot Sandwiches',
        items: [
          { name: 'Albuquerque Turkey Sandwich', description: null, portion: '1 ea', calories: 680, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cheesy Veggie Melt', description: null, portion: '1 ea', calories: 610, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian Chicken Tostini', description: 'Grilled Chicken Breast, Pepperoni, Spinach, Roasted Red Peppers, Mozzarella Cheese with Basil Pesto on Ciabatta Bread', portion: '12oz', calories: 740, protein: 30, carbs: 50, fat: 30 },
          { name: 'Pizza Bagel Cheese', description: 'Cheese on Plain Bagel', portion: '6.4oz', calories: 440, protein: 30, carbs: 50, fat: 30 },
          { name: 'Pizza Bagel Pepperoni', description: 'PEPPERONI on a Plain Bagel', portion: '7.1oz', calories: 530, protein: 30, carbs: 50, fat: 30 },
          { name: 'Roasted Veggie Tostini', description: 'Roasted Asparagus, Sautéed Mushrooms, Spinach, Roasted Red Peppers, Balsamic Onions, Mozzarella Cheese with Garlic & Herb Shmear on Ciabatta Bread', portion: '10.5oz', calories: 510, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Chicken Ciabatta', description: null, portion: '1 ea', calories: 620, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Signature Egg Sandwiches',
        items: [
          { name: 'All Nighter Egg sandwich', description: 'cage free eggs with bacon, cheese, and chipotle aioli on a cheesy hash brown bagel', portion: 'one sandwich', calories: 900, protein: 30, carbs: 50, fat: 30 },
          { name: 'Bacon Tomato Avocado Egg White', description: 'Served with your choise of one egg or two.', portion: '8oz', calories: 410, protein: 30, carbs: 50, fat: 30 },
          { name: 'Garden avocado egg sandwich', description: 'cage free eggs with smashed avocado, tomato, spinach, and spread on an everything bagel', portion: 'one sandwich', calories: 510, protein: 30, carbs: 50, fat: 30 },
          { name: 'Santa Fe', description: 'Eggs, Turkey-Sausage, Roasted Tomato Salsa, Pepper Jack Cheese with Jalapeño Salsa Shmear on an Asiago Bagel', portion: '11oz', calories: 600, protein: 30, carbs: 50, fat: 30 },
          { name: 'Santa Fe Wrap', description: 'Eggs, Turkey-Sausage, Roasted Tomato Salsa, Pepper Jack Cheese with Jalapeño Salsa Shmear on a Whole Wheat Tortilla', portion: '10.4oz', calories: 710, protein: 30, carbs: 50, fat: 30 },
          { name: 'Southwest Egg White', description: 'Egg Whites, Turkey-Sausage, Pepper Jack Cheese with Tomatillo Salsa and Plain Shmear on a Plain Thintastic™ Bagel', portion: '7.5oz', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: 'Southwest Egg White on Thin White', description: 'Egg Whites, Turkey-Sausage, Pepper Jack Cheese with Tomatillo Salsa and Reduced Fat Plain Shmear on a Plain Thintastic™ Bagel', portion: '7.7oz', calories: 410, protein: 30, carbs: 50, fat: 30 },
          { name: 'Southwest Whole Egg on Plain Thin', description: 'Whole Egg, Turkey-Sausage, Pepper Jack Cheese with Tomatillo Salsa and Plain Shmear on a Plain Thintastic™ Bagel', portion: '7.5oz', calories: 430, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spinach, Mushroom & Swiss, on 9 grain bagel', description: 'Served with your choice of one egg or two.', portion: '10oz', calories: 530, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Signature Bagels',
        items: [
          { name: 'Asiago Cheese', description: 'Asiago Cheese Bagel', portion: '1 Bagel', calories: 300, protein: 30, carbs: 50, fat: 30 },
          { name: 'Blueberry', description: 'Blueberry', portion: '1 bagel', calories: 290, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Chip', description: 'Chocolate Chip', portion: '1 bagel', calories: 300, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cinnamon Sugar', description: 'Cinnamon Sugar', portion: '1 bagel', calories: 300, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Thintastic Bagels',
        items: [
          { name: 'Honey Whole Wheat Thin', description: 'Honey Whole Wheat Thin', portion: '1 Thin', calories: 190, protein: 30, carbs: 50, fat: 30 },
          { name: 'Plain Thin', description: 'Plain Thin', portion: '1 Thin', calories: 190, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Cold Brew Frozen Shakes',
        items: [
          { name: 'Caramel Cold Brew Shake', description: null, portion: '16 fl oz', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: 'Caramel Cold Brew Shake Coffee Free', description: null, portion: '16 fl oz', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Cold Brew Shake', description: null, portion: '16 fl oz', calories: 380, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Cold Brew Shake Coffee Free', description: null, portion: '16 fl oz', calories: 380, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Cold Brew Shake', description: null, portion: '16 fl oz', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Cold Brew Shake Coffee Free', description: null, portion: '16 fl oz', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Cold Brew Shake', description: null, portion: '16 fl oz', calories: 350, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Cold Brew Shake Coffee Free', description: null, portion: '16 fl oz', calories: 350, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Smoothies',
        items: [
          { name: 'Strawberry Banana Smoothie', description: null, portion: '16 fl oz', calories: 280, protein: 30, carbs: 50, fat: 30 },
        ],
      },
    ],
  },
  'Houston Street Subs - Underground Food Court': {
    categories: [
      {
        name: 'Traditional',
        items: [
          { name: 'Basic Chicken', description: 'Chicken Breast, Mozzarella, Lettuce, Tomato, Red Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Buffalo Chicken', description: 'Roasted Chicken Breast, Provolone Cheese, Lettuce, Tomatoes, and spicy Buffalo sauce', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Classic Turkey', description: 'Sliced Turkey, Provolone, Lettuce, Tomato, Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Custom Sub', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Wrap', description: 'Chickpea Hummus, Spinach, Tomatoes, Onions, Cucumbers, and Tzatziki sauce wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian', description: 'Pepperoni, Ham, Salami, Provolone, Mayo, Lettuce, Tomatoes, Hot Pepper Relish, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Perfect Ham', description: 'Ham, Swiss Cheese, Lettuce, Tomato, and Honey Mustard', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Santa Fe', description: 'Roasted Chicken Breast, Pepper-Jack Cheese, Lettuce, Pico de Gallo, Avocado, and Chipotle Mayo', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Capri', description: 'Ham, Provolone, Banana Peppers, Lettuce, Tomato, Onions, and Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Clubs',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Ham, Bacon, Provolone, Lettuce, Tomatoes, and Tangy Chipotle Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cali Club', description: 'Turkey, Bacon, Shredded Lettuce, Sliced Tomatoes, and Creamy Avocado Ranch', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Kolaches and Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Chip Cookie', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Any 10" Sub Sandwich', value: 12.78 },
        { name: 'Any Chopped Salad', value: 12.78 },
      ],
    },
  },
  'Bagel Block': {
    categories: [
      {
        name: 'Polite Coffee',
        items: [
          { name: 'Blue Sky Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast in Bed Latte', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Cappuccino', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Caramel Two Step Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chai Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Cherry Crush Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Coconut Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Drip Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Garden Party Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Gingerbread Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hazelnut Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Hot Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Irish Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Kyle House Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'London Fog', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Maroon Lagoon Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peppermint Mocha', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Snickerdoodle Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Kolache',
        items: [
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Melts',
        items: [
          { name: 'BYO Deli Bagel', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Italian Chicken', description: 'Bagel topped with Chicken, Pepperoni, Provolone, Red Onion, Spinach, and Herb Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Spicy Chicken', description: 'Chicken, Bacon, Cheddar, Red Onion, and Jalapeno Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'The Diplomat', description: 'Bagel with Turkey, Cucumber, Lettuce, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Deli Delights',
        items: [
          { name: 'Hungry Howdy', description: 'Ham, Turkey, Lettuce, Tomato, Red Onion, Provolone, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB & J Bagel', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Veggie Delight', description: 'Lettuce, Cucumber, Red Onion, and Veggie Cream Cheese on a Bagel', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
        ],
      },
      {
        name: 'Breakfast',
        items: [
          { name: 'Aggie Classic', description: 'Bagel topped with egg, bacon, ham, black pepper, and plain cream cheese', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'BYO Breakfast Bagel', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bagel and Cream Cheese', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bruschetta Bagel', description: 'Bagel topped with Hummus, Sliced Tomato, Fresh Spinach, and Provolone', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Power Protein Bagel', description: 'Bagel with Peanut butter, fresh banana, and honey drizzle', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Rev\'s Sunshine Bagel', description: 'Bagel topped with Egg, Tomatoes, fresh Spinach, and plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
  },
  'Pizza @ Underground': {
    categories: [
      {
        name: '8 Inch Pizzas',
        items: [
          { name: 'Cheese Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Chicken Spinach Alfredo Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Italian Sausage Alfredo', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pepperoni Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Sausage Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Spinach Tomato Garlic Pesto', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
        ],
      },
      {
        name: '16 Inch Pizzas',
        items: [
          { name: '1 Topping Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: '3 Topping Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Italian Sausage Alfredo', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Appetizers and Mac',
        items: [
          { name: 'Custom Mac and Cheese', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Parmesan Bread Bites', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pepperoni Rolls', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Pizza @ Underground include the choice of a 16.9 oz. bottled water or a medium fountain drink!',
      combos: [
        { name: 'Personal Cheese Pizza (Vegetarian)', value: 9.68 },
        { name: 'Personal Pepperoni Pizza', value: 9.68 },
        { name: 'Personal Baked Pasta', value: 8.49 },
      ],
    },
  },
  'Smoothie King - Sbisa Underground Food Court': {
    categories: [
    ],
  },
  'Abu Omar Halal - MSC': {
    categories: [
      {
        name: 'Meals',
        items: [
          { name: 'Arabi', description: 'Your Choice of Protein, Veggies, and Creamy Sauce wrapped in a pressed Tortilla. Sliced and served with seasoned french fries and mixed pickled veggies', portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Italian Shawarma', description: 'Your Choice of Protein, Shredded Cheddar Cheese, Garlic Sauce, in Pressed Sesame Seed Italian Bread. Cut into 8  Slices and served with Seasoned French Fries, Mixed Vegetables Pickles, and a Side of Garlic Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Loaded Fries', description: 'Your Choice of Protein over Seasoned Fries with Melted Cheddar, Veggies, and Sauce', portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Quesadilla', description: 'Your Choice of Protein, Shredded Cheddar Cheese, Garlic Sauce, in a Tortilla.  Cut into 4 slices and served with Seasoned French Fries, Mixed Pickled Veggies, and Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Rice Bowl', description: 'Choice of Protein over, Vermicelli Rice, or yellow rice served with a side Salad of Diced Tomatoes and Onions, yellow Corn, Jalapenos, Chickpeas, and Black Olives', portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Salad Bowl', description: 'Choice of Protein aver a Salad of Shredded Lettuce, Diced Tomatoes and Onions, yellow Corn, Jalapenos, Chickpeas, and Black Olives', portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Sandwich', description: 'Your Choice of Protein, Vegetables, and Garlic Sauce in a pressed tortilla wrap.', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'French Fries', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Cauliflower', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grape Leaves (4pc)', description: '4 Grape Leaves stuffed with a delicious herb and rice mix and formed into small rolls. Boiled until tender', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hummus', description: null, portion: '—', calories: 250, protein: 8, carbs: 20, fat: 15 },
          { name: 'Kibbeh', description: 'Football shaped fried beef ball stuffed with seasoned ground beef and sauteed chopped onions', portion: '—', calories: 250, protein: 8, carbs: 20, fat: 15 },
        ],
      },
      {
        name: 'Desserts',
        items: [
          { name: 'Baklava', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Cheesecake', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Donuts', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Abu Omar Halal include a medium fountain drink!',
      combos: [
        { name: 'Rice Bowl Combo', value: 15.0 },
      ],
    },
  },
  'Cabo Grill - MSC': {
    categories: [
      {
        name: 'Tacos',
        items: [
          { name: '2 Ground Beef Tacos', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: '2 Marinated Steak Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: '2 Roasted Veggie Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: '2 Spice Rubbed Chicken Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Bowls',
        items: [
          { name: 'Ground Beef Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Marinated Steak Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Roasted Veggie Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Spice Rubbed Chicken Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
        ],
      },
      {
        name: 'Burritos',
        items: [
          { name: 'Ground Beef Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Marinated Steak Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Roasted Veggie Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spice Rubbed Chicken Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Ground Beef Salad', description: null, portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Marinated Steak Salad', description: null, portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Roasted Veggie Salad', description: null, portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Spice Rubbed Chicken Salad', description: null, portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Chips and Guacamole', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chips and Queso', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Chips and Salsa', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Gatorade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Cabo Grill include the choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Avoiding Gluten, and Halal available.',
      combos: [
        { name: 'Build Your Own Burrito', value: 11.45 },
        { name: 'Build Your Own Bowl', value: 11.98 },
      ],
    },
  },
  'Chick-Fil-A - MSC Food Court': {
    categories: [
      {
        name: 'Entrees',
        items: [
          { name: '12 ct Grilled Nuggets', description: 'Bite-sized pieces of freshly marinated boneless breast of chicken, grilled for a tender and juicy backyard-smoky taste.', portion: '12 Count', calories: 170, protein: 30, carbs: 50, fat: 30 },
          { name: '12 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '12 Count', calories: 390, protein: 30, carbs: 50, fat: 30 },
          { name: '8 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '8 Count', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: '8 ct. Grilled Nuggets', description: 'Bite-sized pieces of freshly marinated boneless breast of chicken, grilled for a tender and juicy backyard-smoky taste.', portion: '8 Count', calories: 110, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-A® Chicken Sandwich', description: 'A boneless breast of chicken seasoned to perfection, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips.', portion: '1 each', calories: 440, protein: 29, carbs: 41, fat: 18 },
          { name: 'Chicken Sandwich', description: null, portion: '1 each', calories: 420, protein: 30, carbs: 50, fat: 30 },
          { name: 'Deluxe Sandwich', description: null, portion: '1 each', calories: 490, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Club Sandwich', description: null, portion: '1 each', calories: 520, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Sandwich', description: 'A lemon-herb marinated boneless breast of chicken, grilled for a tender and juicy backyard-smokey taste, served on a toasted Multigrain Brioche bun with Green Leaf lettuce and tomato.', portion: '1 each', calories: 380, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Nuggets', description: null, portion: '8 ct', calories: 130, protein: 30, carbs: 50, fat: 30 },
          { name: 'Nuggets', description: null, portion: '8 ct', calories: 250, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Chicken Sandwich', description: 'A boneless breast of chicken seasoned with a spicy blend of peppers, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips.', portion: '1 each', calories: 460, protein: 28, carbs: 43, fat: 19 },
          { name: 'Spicy Chicken Sandwich Deluxe', description: 'A boneless breast of chicken seasoned with a spicy blend of peppers, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips, Green Leaf lettuce, tomato and Pepper Jack Cheese.', portion: '1 each', calories: 550, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Deluxe Sandwich', description: null, portion: '1 each', calories: 540, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Cobb Salad', description: null, portion: '1 each', calories: 690, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Market Salad', description: 'Grilled and sliced chicken breast served on a fresh bed of chopped Romaine lettuce and baby greens, topped with shredded red cabbage and carrots, crumbled blue cheese and a mix of red and green apples, strawberries and blueberries.', portion: '1 salad', calories: 200, protein: 30, carbs: 50, fat: 30 },
          { name: 'Market Salad', description: null, portion: '1 each', calories: 550, protein: 28, carbs: 41, fat: 31 },
          { name: 'Spicy Southwest Salad', description: null, portion: '1 each', calories: 680, protein: 33, carbs: 37, fat: 27 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Berry Parfait', description: null, portion: '1 each', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-a Sauce Flavored Waffle Potato Chips', description: null, portion: '1 each', calories: 210, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruit Cup', description: 'A nutritious fruit mix made with chopped pieces of red and green apples, mandarin orange segments, fresh strawberry slices, and blueberries, served chilled. Prepared fresh daily.', portion: 'Medium', calories: 60, protein: 30, carbs: 50, fat: 30 },
          { name: 'Kale Crunch Side', description: null, portion: '1 each', calories: 170, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mac & Cheese', description: null, portion: 'Medium', calories: 450, protein: 16, carbs: 29, fat: 29 },
          { name: 'Original Flavor Waffle Potato Chips', description: null, portion: '1 bag', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Side Salad', description: null, portion: '1 each', calories: 70, protein: 30, carbs: 50, fat: 30 },
          { name: 'Waffle Potato Fries', description: null, portion: 'Medium', calories: 420, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Treats',
        items: [
          { name: 'Chocolate Chunk Cookie', description: null, portion: '1 each', calories: 370, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Fudge Brownie', description: null, portion: '1 each', calories: 370, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Milkshake', description: null, portion: '1 each', calories: 600, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cookies & Cream Milkshake', description: null, portion: '1 each', calories: 630, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Coffee', description: null, portion: '1 each', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Lemonade', description: null, portion: '1 each', calories: 350, protein: 30, carbs: 50, fat: 30 },
          { name: 'Frosted Lemonade w/ Diet Lemonade', description: null, portion: '1 each', calories: 280, protein: 30, carbs: 50, fat: 30 },
          { name: 'Icedream Cone', description: null, portion: '1 each', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'Icedream Cup', description: null, portion: '1 each', calories: 140, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Milkshake', description: null, portion: '1 each', calories: 560, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Milkshake', description: null, portion: '1 each', calories: 580, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Chick-fil-A® Diet Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water. Diet Lemonade is sweetened with Splenda® No Calorie Sweetener.', portion: 'Medium', calories: 50, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chick-fil-A® Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water.', portion: 'Medium', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Coffee', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'DASANI® Bottled Water', description: 'DASANI® combines the process of reverse osmosis filtration with a proprietary blend of minerals to create fresh, clean, and premium tasting water that is pure and delicious.', portion: '1 bottle', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Diet Lemonade', description: null, portion: 'Medium', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Freshly-Brewed Iced Tea (Large)', description: 'Sweetened tea', portion: '1 each', calories: 170, protein: 10, carbs: 30, fat: 10 },
          { name: 'Freshly-Brewed Iced Tea Sweetened', description: 'Freshly-brewed each day from a blend of tea leaves. Available sweetened with real cane sugar.', portion: 'Medium', calories: 120, protein: 10, carbs: 30, fat: 10 },
          { name: 'Freshly-Brewed Iced Tea Unsweetened', description: 'Freshly-brewed each day from a blend of tea leaves. Available unsweetened.', portion: 'Medium', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Iced Coffee', description: null, portion: '—', calories: 200, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea Sweetened', description: null, portion: 'Medium', calories: 12, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea Unsweetened', description: null, portion: 'Medium', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Lemonade', description: null, portion: 'Medium', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sunjoy', description: null, portion: 'Medium', calories: 240, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Iced Coffee', description: null, portion: '—', calories: 200, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dipping Sauces',
        items: [
          { name: 'Barbecue Sauce', description: 'Barbecue Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Barbeque Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-A® Sauce', description: 'Chick-Fil-A Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-a Sauce', description: null, portion: '1 each', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Sauce', description: 'Garden Herb Ranch Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Ranch Sauce', description: null, portion: '1 each', calories: 100, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Mustard Sauce', description: 'Honey Mustard Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Roasted BBQ Sauce', description: 'Honey Roasted BBQ Sauce', portion: '1 packet', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Polynesian Sauce', description: 'Polynesian Sauce', portion: '1 packet', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sweet & Spicy Sriracha Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Buffalo Sauce', description: 'Buffalo Sauce', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dressings',
        items: [
          { name: 'Avocado Lime Ranch Dressing', description: 'avocado lime dressing', portion: '1 Packet', calories: 310, protein: 10, carbs: 30, fat: 10 },
          { name: 'Creamy Salsa Dressing', description: 'creamy salsa', portion: '1 Packet', calories: 290, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat Free Honey Mustard Dressing', description: 'Fat Free Honey Mustard Dressing', portion: '1 packet', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat-Free Honey Mustard Dressing', description: null, portion: '1 each', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Dressing', description: 'Garden Herb Ranch Dressing', portion: '1 packet', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garlic and Herb Ranch Dressing', description: 'garlic and herb dressing', portion: '1 Packet', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Balsamic Vinaigrette', description: 'light balsamic dressing', portion: '1 Packet', calories: 80, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Balsamic Vinaigrette Dressing', description: 'Light Balsamic Vinaigrette Dressing', portion: '1 packet', calories: 80, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Italian Dressing', description: 'Light Italian Dressing', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mayonnaise', description: 'creamy', portion: '1 Tbsp', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Apple Cider Vinaigrette', description: 'apple cider dressing', portion: '1 Packet', calories: 230, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Apple Cider Vinaigrette Dressing', description: null, portion: '1 each', calories: 230, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!',
      combos: [
        { name: 'Original Chicken Sandwich', value: 9.49 },
        { name: 'Spicy Chicken Sandwich', value: 9.79 },
        { name: '8 Piece Chicken Nuggets', value: 9.59 },
        { name: 'Avoiding Gluten - Grilled Chicken Sandwich', value: 9.49 },
      ],
    },
  },
  'Houston Street Subs - MSC': {
    categories: [
      {
        name: 'Traditional',
        items: [
          { name: 'Basic Chicken', description: 'Chicken Breast, Mozzarella, Lettuce, Tomato, Red Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 29, carbs: 41, fat: 18 },
          { name: 'Buffalo Chicken', description: 'Roasted Chicken Breast, Provolone Cheese, Lettuce, Tomatoes, and spicy Buffalo sauce', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Turkey', description: 'Sliced Turkey, Provolone, Lettuce, Tomato, Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Custom Sub', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Wrap', description: 'Chickpea Hummus, Spinach, Tomatoes, Onions, Cucumbers, and Tzatziki sauce wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian', description: 'Pepperoni, Ham, Salami, Provolone, Mayo, Lettuce, Tomatoes, Hot Pepper Relish, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Perfect Ham', description: 'Ham, Swiss Cheese, Lettuce, Tomato, and Honey Mustard', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Santa Fe', description: 'Roasted Chicken Breast, Pepper-Jack Cheese, Lettuce, Pico de Gallo, Avocado, and Chipotle Mayo', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Capri', description: 'Ham, Provolone, Banana Peppers, Lettuce, Tomato, Onions, and Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Clubs',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Ham, Bacon, Provolone, Lettuce, Tomatoes, and Tangy Chipotle Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cali Club', description: 'Turkey, Bacon, Shredded Lettuce, Sliced Tomatoes, and Creamy Avocado Ranch', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Kolaches and Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Chip Cookie', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Any 10" Sub Sandwich', value: 12.78 },
        { name: 'Any Chopped Salad', value: 12.78 },
      ],
    },
  },
  'ILCB Food Truck': {
    categories: [
    ],
  },
  'Market at Lamar St.': {
    categories: [
      {
        name: 'Deli Delights',
        items: [
          { name: 'BYO Deli Bagel', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hungry Howdy', description: 'Bagel with Ham, Turkey, Lettuce, Tomato, Red Onion, Provolone, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Italian Chicken', description: 'Bagel with Chicken, Pepperoni, Red Onion, Spinach, and Herb Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'PB & J Bagel', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Spicy Chicken', description: 'Bagel with Chicken, Bacon, Red Onion, and Jalapeno Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'The Diplomat', description: 'Bagel with Turkey, Cucumber, Lettuce, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight', description: 'Bagel with Lettuce, Cucumber, Red Onion, and Veggie Cream Cheese', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
        ],
      },
      {
        name: 'Breakfast',
        items: [
          { name: 'Aggie Classic', description: 'Plain bagel topped with Egg, Bacon, Ham, Black Pepper, and Plain Cream Cheese', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'BYO Breakfast Bagel', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bagel with Cream Cheese', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bruschetta Bagel', description: 'Bagel topped with Hummus, Sliced Tomato, Fresh Spinach, and Provolone', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Power Protein Bagel', description: 'Bagel with Peanut Butter, Fresh Banana, and Honey Drizzle', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Rev\'s Sunshine Bagel', description: 'Bagel with Egg, Tomato, Fresh Spinach, and Plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Polite Coffee',
        items: [
          { name: 'Americano', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Blue Sky Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast in Bed Latte', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Cappuccino', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Caramel Two Step Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chai Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Cherry Crush Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Coconut Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Drip Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Garden Party Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Gingerbread Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hazelnut Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Chocolate', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Hot Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Irish Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Kyle House Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'London Fog', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Maroon Lagoon Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Snickerdoodle Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Refreshers',
        items: [
          { name: 'Black Tea Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Creamy Coconut Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Dragon-Strawberry Green Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Dragon-Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pina Colada Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Pineapple Strawberry Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Salted Caramel Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Thai Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Tropical Pineapple Splash', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
  },
  'Panda Express - MSC': {
    categories: [
      {
        name: 'Sides',
        items: [
          { name: 'Chow Mein', description: 'Chow Mein', portion: '1 each', calories: 600, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Rice', description: 'Fried Rice', portion: '1 each', calories: 620, protein: 13, carbs: 82, fat: 16 },
          { name: 'Super Greens', description: 'A healthful medley of broccoli, kale, and cabbage.', portion: '7', calories: 90, protein: 9, carbs: 14, fat: 4 },
        ],
      },
      {
        name: 'Vegetables',
        items: [
          { name: 'Eggplant Tofu', description: 'Eggplant and Tofu', portion: '6.1oz', calories: 340, protein: 10, carbs: 30, fat: 10 },
          { name: 'Super Greens (Entree)', description: 'A healthful medley of broccoli, kale, and cabbage.', portion: '7 oz', calories: 90, protein: 9, carbs: 14, fat: 4 },
        ],
      },
      {
        name: 'Chicken',
        items: [
          { name: 'Black Pepper Chicken', description: 'Marinated chicken, celery and onions in a bold black pepper sauce.', portion: '6.3oz', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Teriyaki Chicken', description: 'Grilled chicken thigh hand-sliced to order and served with teriyaki sauce', portion: '6oz', calories: 275, protein: 36, carbs: 14, fat: 10 },
          { name: 'Kung Pao Chicken', description: 'A Sichuan-inspired dish with chicken, peanuts and vegetables, finished with chili peppers.', portion: '6.7oz', calories: 320, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mushroom Chicken', description: 'A delicate combination of chicken, mushrooms and zucchini wok-tossed with a light ginger soy sauce.', portion: '5.7oz', calories: 220, protein: 16, carbs: 10, fat: 12 },
          { name: 'Teriyaki Chicken', description: null, portion: '6oz', calories: 340, protein: 36, carbs: 14, fat: 10 },
          { name: 'The Original Orange Chicken®', description: 'Our signature dish. Crispy chicken wok-tossed in a sweet and spicy orange sauce.', portion: '5.9oz', calories: 510, protein: 26, carbs: 53, fat: 24 },
        ],
      },
      {
        name: 'Chicken Breast',
        items: [
          { name: 'Honey Sesame Chicken Breast', description: 'Honey Sesame Chicken Breast', portion: '1 each', calories: 340, protein: 10, carbs: 30, fat: 10 },
          { name: 'String Bean Chicken Breast', description: 'Chicken breast, string beans and onions wok-tossed in a mild ginger soy sauce.', portion: '5.6oz', calories: 210, protein: 14, carbs: 16, fat: 11 },
          { name: 'Sweet & Sour Chicken Breast', description: 'sweet & sour chicken breast', portion: '5.5oz', calories: 300, protein: 10, carbs: 40, fat: 10 },
          { name: 'SweetFire Chicken Breast®', description: 'Crispy, white-meat chicken, red bell peppers, onions and pineapples in a bright and sweet chili sauce.', portion: '5.8oz', calories: 360, protein: 15, carbs: 47, fat: 15 },
        ],
      },
      {
        name: 'Beef',
        items: [
          { name: 'Beijing Beef®', description: 'Crispy beef, bell peppers and onions in a sweet-tangy sauce.', portion: '5.6oz', calories: 480, protein: 10, carbs: 30, fat: 10 },
          { name: 'Black Pepper Sirloin Steak', description: 'Angus steak wok-seared with baby broccoli, onions, red bell peppers and mushrooms in a savory black pepper sauce.', portion: '5.1oz', calories: 210, protein: 19, carbs: 16, fat: 10 },
          { name: 'Broccoli Beef', description: 'A classic favorite. Tender beef and fresh broccoli in a ginger soy sauce.', portion: '5.4oz', calories: 150, protein: 11, carbs: 13, fat: 7 },
        ],
      },
      {
        name: 'Seafood',
        items: [
          { name: 'Honey Walnut Shrimp', description: 'Large tempura-battered shrimp, wok-tossed in a honey sauce and topped with glazed walnuts.', portion: '4.39oz', calories: 430, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Appetizers',
        items: [
          { name: 'Chicken Egg Roll', description: 'Cabbage, carrots, green onions and chicken in a crispy wonton wrapper.', portion: '2.75oz/1 roll', calories: 200, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cream Cheese Rangoon', description: 'Wonton wrappers filled with cream cheese and served with sweet and sour sauce.', portion: '2.4oz/3pcs', calories: 190, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vegetable Spring Roll', description: 'Cabbage, celery, carrots, green onions and Chinese noodles in a crispy wonton wrapper.', portion: '3.5oz/2 rolls', calories: 240, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'More',
        items: [
          { name: 'Fortune Cookie', description: 'Fortune Cookie', portion: '5g/1 pc', calories: 20, protein: 10, carbs: 30, fat: 10 },
          { name: 'Soy Sauce', description: null, portion: '0.21oz', calories: 5, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sweet & Sour Sauce', description: 'Sweet & Sour Sauce', portion: '1.8oz', calories: 70, protein: 10, carbs: 30, fat: 10 },
          { name: 'Teriyaki Sauce', description: 'Teriyaki Sauce', portion: '1.8oz', calories: 70, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Panda Express include the choice of a 16.9 oz. bottled water or a medium fountain drink!',
      combos: [
        { name: 'Orange Chicken Bowl', value: 10.2 },
        { name: 'Kung Pao Chicken Bowl', value: 10.2 },
        { name: 'Teriyaki Chicken Bowl', value: 10.2 },
        { name: 'Broccoli Beef Bowl', value: 10.2 },
        { name: 'Beijing Beef Bowl', value: 10.2 },
      ],
    },
  },
  'Rev\'s American Grill - MSC': {
    categories: [
      {
        name: 'Burgers',
        items: [
          { name: 'BYO Burger', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Bacon Cheeseburger', description: 'Our signature Beef Patty topped with Crispy Bacon and American cheese on a Toasty Bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Black Bean Burger', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cheeseburger', description: 'One sizzling patty topped with rich American cheese, signature Gig \'Em sauce and pickles', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Hamburger', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Double Stack Burger', description: 'Two high-quality Beef Patties, Two slices of American cheese, our signature Gig \'Em sauce and pickles!', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Gig Em Patty Melt', description: 'Beef patty served on buttery Texas Toast, slathered in Gig \'Em sauce, and served with Caramelized Onions and American Swiss Cheese.', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'King Kong Burger', description: 'Our Signature Beef Patty topped with a Fried Egg, French Fries, Melted Cheese, and smothered in King Kong Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sandwiches',
        items: [
          { name: 'Aggie Chicken Club', description: 'Crispy Chicken Breast, American Swiss Cheese, Bacon, and Fresh Avocado on a Toasted Bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Sandwich', description: 'Marinated Juicy Chicken Breast served on a Toasted Bun and Topped with Veggies', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Chicken Sandwich', description: 'Country Breaded Chicken Breast Patty smothered in Fresh Ranch, Buffalo Sauce, and shredded Lettuce in a Toasty Bun', portion: '—', calories: 650, protein: 28, carbs: 43, fat: 19 },
        ],
      },
      {
        name: 'Baskets',
        items: [
          { name: 'Tender Combo', description: 'Three Crispy Chicken Tenders served with a side of French Fries and a Drink.', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Sides and Desserts',
        items: [
          { name: 'Aggie Shakes', description: 'Handspun Milkshake in your Flavor of Choice!', portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Cookie Ice Cream Sundae', description: 'Vanilla Ice Cream sandwiched between 2 Cookies', portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Double Scoop Ice Cream', description: 'A Double Scoop of Ice Cream in your Flavor of Choice!', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'French Fries', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Root Beer Float', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Value Meals',
        items: [
          { name: '2 Hot Dogs', description: '2 All Beef Hot Dogs with your choice of Ketchup, Mustard, Onion, & Relish', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: '3 Tender Entree', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: '12 oz Water Bottle', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: '20 oz Water Bottle', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Rev\'s American Grill include original fries and choice of a 16.9 oz. bottled water or a medium fountain drink! Avoiding Gluten buns available.',
      combos: [
        { name: 'Classic Hamburger', value: 10.48 },
        { name: 'Classic Cheeseburger', value: 10.78 },
        { name: 'Chicken Tender Basket', value: 8.49 },
        { name: 'Spicy Buffalo Fried Chicken Sandwich', value: 11.68 },
        { name: 'Deluxe Fried Chicken Sandwich', value: 11.68 },
        { name: 'Black Bean Burger (Vegetarian)', value: 10.58 },
      ],
    },
  },
  'Starbucks Coffee - Evans Library': {
    categories: [
    ],
  },
  'Shake Smart - MSC': {
    categories: [
      {
        name: 'Protein Balls',
        items: [
          { name: 'Cookie Dough', description: null, portion: '1 ball', calories: 134, protein: 30, carbs: 50, fat: 30 },
          { name: 'Magic Matcha', description: null, portion: '1 ball', calories: 142, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Craft Your Cup',
        items: [
          { name: 'Classic Oatmeal Base - no agave', description: null, portion: '1 serving', calories: 160, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Oatmeal Base - with agave', description: null, portion: '1 serving', calories: 202, protein: 30, carbs: 50, fat: 30 },
          { name: 'Overnight Oats Base - no agave', description: null, portion: '1 serving', calories: 180, protein: 30, carbs: 50, fat: 30 },
          { name: 'Overnight Oats Base - with agave', description: null, portion: '1 serving', calories: 222, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Classic Shakes',
        items: [
          { name: 'Chocolate Frosty - 1/2 agave', description: 'regular shakes (bases off non-fat milk/whey protein)', portion: '1 Shake', calories: 215, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Frosty - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cookies n\' Cream - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 225, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cookies n\' Cream - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 270, protein: 30, carbs: 50, fat: 30 },
          { name: 'Shake Your Coffee - 1/2 agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 163, protein: 30, carbs: 50, fat: 30 },
          { name: 'Shake Your Coffee with agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 211, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Smoothie', description: 'Sweetened fruit puree blended with ice.', portion: '12 oz cup', calories: 100, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Thrilla - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 205, protein: 30, carbs: 50, fat: 30 },
          { name: 'Vanilla Trilla - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 250, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Specialty Shakes',
        items: [
          { name: 'Banana Split - 1/2 agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 227, protein: 30, carbs: 50, fat: 30 },
          { name: 'Banana Split - no agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 185, protein: 30, carbs: 50, fat: 30 },
          { name: 'Banana Split - with agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 269, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grammy\'s Goods - 1/2 agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 323, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grammy\'s Goods - no agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 275, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grammy\'s Goods - with agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 371, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB Squared - 1/2 agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 300, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB Squared - no agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 258, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB Squared with agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 342, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Fields - 1/2 agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Sheake', calories: 192, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Fields - no agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 150, protein: 30, carbs: 50, fat: 30 },
          { name: 'Strawberry Fields - with agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 234, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Blended Bowls',
        items: [
          { name: 'Dragon Bowl Base - 1/2 agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 239, protein: 30, carbs: 50, fat: 30 },
          { name: 'Dragon Bowl Base - no agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 197, protein: 30, carbs: 50, fat: 30 },
          { name: 'Dragon Bowl Base with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein, Topped with Granola, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 281, protein: 30, carbs: 50, fat: 30 },
          { name: 'Original Acai Bowl Base - 1/2 agave', description: 'Organic Acai, Strawberry, Apple Juice, Protein, Topped with Granola and Banana Slices', portion: '1 Bowl', calories: 382, protein: 30, carbs: 50, fat: 30 },
          { name: 'Original Acai Bowl Base - no agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 240, protein: 30, carbs: 50, fat: 30 },
          { name: 'Original Acai Bowl Base with agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 324, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB&A Base - 1/2 agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 391, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB&A Base - no agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 346, protein: 30, carbs: 50, fat: 30 },
          { name: 'PB&A Base with agave', description: 'Organic Acai, Banana, Peanut Butter, Almond Milk, Protein, Topped with Granola and Cacao', portion: '1 Bowl', calories: 436, protein: 30, carbs: 50, fat: 30 },
          { name: 'Raw-cai', description: 'Scoops of Organic Acai, Strawberry, Topped with Granola, Banana Slices, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 346, protein: 30, carbs: 50, fat: 30 },
          { name: 'Tropicali', description: 'Organic Acai, Pineapple, OJ, Protein, Topped with Granola and Coconut Flakes', portion: '1 Bowl', calories: 385, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'All Natural Sandwiches',
        items: [
          { name: 'Almond Butter Sandwich', description: 'on whole wheat thin bread with bananas', portion: '1 sandwich', calories: 352, protein: 30, carbs: 50, fat: 30 },
          { name: 'Peanut Butter Sandwich', description: 'on whole wheat thin bread with banana slices', portion: '1 sandwich', calories: 342, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Whole Wheat Wraps',
        items: [
          { name: 'BBQ Turkey', description: 'turkey, bbq sauce, spinach, onions', portion: '1 Wrap', calories: 492, protein: 30, carbs: 50, fat: 30 },
          { name: 'BBQ Turkey with cheese', description: 'Turkey, BBQ Sauce, Spinach, Onion, Provolone', portion: '1 Wrap', calories: 590, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cran-Turkey', description: 'Turkey, Cranberry Mustard, Spinach, Onion', portion: '1 Wrap', calories: 437, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cran-Turkey with cheese', description: 'turkey, cranberry mustard, spinach, onions, provolone cheese', portion: '1 Wrap', calories: 535, protein: 30, carbs: 50, fat: 30 },
          { name: 'Rubi\'s Tuna Salad', description: 'tuna, carrot, onion, celery, spinach, swiss', portion: '1 sandwich', calories: 529, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Tuna', description: 'tuna, habanero mustard, onions, spinach', portion: '1 Wrap', calories: 483, protein: 30, carbs: 50, fat: 30 },
          { name: 'Spicy Tuna with cheese', description: 'Tuna, Habanero Mustard, Onion, Spinach, Swiss', portion: '1 Wrap', calories: 589, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey Pesto', description: 'turkey, pesto, spinach, onions, sun dried tomatoes', portion: '1 Wrap', calories: 555, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turkey Pesto with cheese', description: 'Turkey, Pesto, Spinach, Onion, Sun Dried Tomatoes, Swiss cheese', portion: '1 Wrap', calories: 661, protein: 30, carbs: 50, fat: 30 },
          { name: 'Turks & \'matoes', description: 'turkey, spinach, onion, sundried tomatoes, swiss', portion: '1 sandwich', calories: 496, protein: 30, carbs: 50, fat: 30 },
          { name: 'Veggie Delight', description: 'spinach, dijon mustard, hummus, sun dried tomatoes, artichoke, cucumber', portion: '1 Wrap', calories: 343, protein: 30, carbs: 50, fat: 30 },
          { name: 'Veggie Delight with cheese', description: 'Spinach, Dijon Mustard, Hummus, Sun Dried Tomatoes, Swiss', portion: '1 Wrap', calories: 568, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Greens and Veggies',
        items: [
          { name: 'Carrot Cake - 1/2 agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 195, protein: 30, carbs: 50, fat: 30 },
          { name: 'Carrot Cake - no agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 153, protein: 30, carbs: 50, fat: 30 },
          { name: 'Carrot Cake - with agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 236, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green Tea Matcha - 1/2 agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 172, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green Tea Matcha - with agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green To Go - 1/2 agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 194, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green To Go - no agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 152, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green To Go with agave', description: 'spinach, banana, pineapple, orange juice, protein', portion: '1 Shake', calories: 236, protein: 30, carbs: 50, fat: 30 },
          { name: 'Greens To Go - with agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 236, protein: 30, carbs: 50, fat: 30 },
          { name: 'Matcha Mentality 1/2 agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 172, protein: 30, carbs: 50, fat: 30 },
          { name: 'Matcha Mentality with agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 220, protein: 30, carbs: 50, fat: 30 },
          { name: 'Organic Supershake - 1/2 agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 300, protein: 30, carbs: 50, fat: 30 },
          { name: 'Organic Supershake - no agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 258, protein: 30, carbs: 50, fat: 30 },
          { name: 'Organic Supershake - with agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 342, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Scooped Bowls',
        items: [
          { name: 'Raw-PB Base', description: 'Scoops of Organic Acai, Topped with Granola, Banana Slices, Dark Chocolate, and Peanut Butter', portion: '1 Bowl', calories: 305, protein: 30, carbs: 50, fat: 30 },
          { name: 'Raw-PB Base with agave', description: 'scoops of organic acai, topped with granola, banana slices, dark chocolate, and organic peanut butter', portion: '1 Bowl', calories: 353, protein: 30, carbs: 50, fat: 30 },
          { name: 'Rawçaí Base', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 269, protein: 30, carbs: 50, fat: 30 },
          { name: 'Rawçaí Base with agave', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 221, protein: 30, carbs: 50, fat: 30 },
          { name: 'The Buzz Bowl Base', description: 'Scoops of Organic Acai, Pitaya, Pineapple, Strawberry, Topped with Granola, Coconut Flakes, and Bee Pollen', portion: '1 Bowl', calories: 242, protein: 30, carbs: 50, fat: 30 },
          { name: 'The Buzz Bowl Base with agave', description: 'scoops of organic acai, pitaya, pineapple, topped with granola, bee pollen, and coconut flakes', portion: '1 Bowl', calories: 290, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Exotic Shake',
        items: [
          { name: 'A Perfect 10 - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 318, protein: 30, carbs: 50, fat: 30 },
          { name: 'A Perfect 10 - no agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 276, protein: 30, carbs: 50, fat: 30 },
          { name: 'A Perfect 10 - with agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 360, protein: 30, carbs: 50, fat: 30 },
          { name: 'Acai Energy - 1/2 agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 378, protein: 30, carbs: 50, fat: 30 },
          { name: 'Acai Energy - no agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 336, protein: 30, carbs: 50, fat: 30 },
          { name: 'Acai Energy with agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 420, protein: 30, carbs: 50, fat: 30 },
          { name: 'Breakfast To Go - 1/2 agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 241, protein: 30, carbs: 50, fat: 30 },
          { name: 'Breakfast To Go - no agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 199, protein: 30, carbs: 50, fat: 30 },
          { name: 'Breakfast to Go - agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 283, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Covered Strawberry', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 229, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Covered Strawberry - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 271, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chocolate Covered Strawberry - agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 313, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruitopia - 1/2 agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 245, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruitopia - no agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 203, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fruitopia with agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 287, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mea Aloha - 1/2 agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 256, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mea Aloha - no agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 214, protein: 30, carbs: 50, fat: 30 },
          { name: 'Mea Aloha with agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 298, protein: 30, carbs: 50, fat: 30 },
          { name: 'Pink Cadillac - 1/2 agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 239, protein: 30, carbs: 50, fat: 30 },
          { name: 'Pink Cadillac - no agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 197, protein: 30, carbs: 50, fat: 30 },
          { name: 'Pink Cadillac with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 281, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Smart Toast',
        items: [
          { name: 'Almond butter toast no agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 307, protein: 30, carbs: 50, fat: 30 },
          { name: 'Almond butter toast with agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 317, protein: 30, carbs: 50, fat: 30 },
          { name: 'Avocado toast', description: 'organic whole grain bread, avocado mash, feta cheese, sun dried tomatoes, crushed red pepper, crystalized lemon, himalayan sea salt', portion: '1', calories: 260, protein: 30, carbs: 50, fat: 30 },
          { name: 'Peanut butter toast no agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 295, protein: 30, carbs: 50, fat: 30 },
          { name: 'Peanut butter toast with agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 305, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'PourOver',
        items: [
          { name: 'Coldbrew', description: 'choice of milk, add protein, matcha or cinnamon', portion: '1', calories: 30, protein: 30, carbs: 50, fat: 30 },
          { name: 'Green tea matcha', description: 'choice of milk, add protein', portion: '1', calories: 150, protein: 30, carbs: 50, fat: 30 },
        ],
      },
    ],
    maroonMeals: {
      note: 'Shake Smart Maroon Meal options.',
      combos: [
        { name: 'Regular Size Shake with Choice of Milk', value: 8.74 },
        { name: 'Scooped or Blended Acai Bowl', value: 10.27 },
        { name: 'Smart Toast', value: 7.94 },
      ],
    },
  },
  'Spin \'N Stone Pizza - MSC': {
    categories: [
      {
        name: 'Pizzas',
        items: [
          { name: '1 Topping Pizza', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'BYO Pizza (up to 4 Toppings)', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Cheese Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Pepperoni Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Soda', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Gatorade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Water Liter', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Spin \'n Stone Pizza in the MSC include a medium fountain drink!',
      combos: [
        { name: 'Personal Cheese Pizza (Vegetarian)', value: 9.48 },
        { name: 'Personal Pepperoni Pizza', value: 10.98 },
      ],
    },
  },
  'Whoop Coop': {
    categories: [
      {
        name: 'Combos',
        items: [
          { name: '4 Tender Combo', description: '4 piece chicken tenders with coleslaw, Texas toast, french fries, your dipping sauce of choice, and a fountain drink!', portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: '6 Tender Combo', description: '6 piece chicken tenders with coleslaw, Texas toast, french fries, your dipping sauce of choice, and a fountain drink!', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: '6 pc Cauliflower Nugget Combo', description: '6 piece fried Cauliflower Nuggets with coleslaw, Texas toast, french fries, your dipping sauce of choice, and a fountain drink', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chicken Tender Sandwich Combo', description: 'Chicken Tender Sandwich topped with Chipotle Ketchup and Slaw in a Toasted Bun. Served with Fries and a Fountain Drink', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fried Zucchini Combo', description: '6 pieces of Fried Zucchini served with Fries, Toast, Coleslaw, and a Fountain Drink with your choice of sauce', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'A La Carte',
        items: [
          { name: 'Chicken Tender Sandwich', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Cheese Curds', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Mac N Cheese', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Large French Fry', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mac & Cheese', description: null, portion: '—', calories: 300, protein: 16, carbs: 29, fat: 29 },
          { name: 'Onion Rings', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Whoop Coop include french fries, toast, coleslaw, sauce, and a medium fountain drink!',
      combos: [
        { name: '4 Piece Chicken Tender Combo', value: 9.29 },
        { name: 'Chicken Tender Sandwich Combo', value: 7.99 },
        { name: '6 Piece Fried Cauliflower Nugget Combo (Vegetarian)', value: 8.99 },
        { name: '6 Piece Fried Zucchini Combo (Vegetarian)', value: 9.49 },
      ],
    },
  },
  'Starbucks Coffee - The Quad': {
    categories: [
    ],
  },
  'Houston Street Subs - Southside': {
    categories: [
      {
        name: 'Traditional',
        items: [
          { name: 'Basic Chicken', description: 'Chicken Breast, Mozzarella, Lettuce, Tomato, Red Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Buffalo Chicken', description: 'Roasted Chicken Breast, Provolone Cheese, Lettuce, Tomatoes, and spicy Buffalo sauce', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Classic Turkey', description: 'Sliced Turkey, Provolone, Lettuce, Tomato, Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Custom Sub', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Wrap', description: 'Chickpea Hummus, Spinach, Tomatoes, Onions, Cucumbers, and Tzatziki sauce wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian', description: 'Pepperoni, Ham, Salami, Provolone, Mayo, Lettuce, Tomatoes, Hot Pepper Relish, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Perfect Ham', description: 'Ham, Swiss Cheese, Lettuce, Tomato, and Honey Mustard', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Santa Fe', description: 'Roasted Chicken Breast, Pepper-Jack Cheese, Lettuce, Pico de Gallo, Avocado, and Chipotle Mayo', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Capri', description: 'Ham, Provolone, Banana Peppers, Lettuce, Tomato, Onions, and Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Clubs',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Ham, Bacon, Provolone, Lettuce, Tomatoes, and Tangy Chipotle Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cali Club', description: 'Turkey, Bacon, Shredded Lettuce, Sliced Tomatoes, and Creamy Avocado Ranch', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Kolaches and Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Chip Cookie', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Any 10" Sub Sandwich', value: 12.78 },
        { name: 'Any Chopped Salad', value: 12.78 },
      ],
    },
  },
  'Azimuth Cafe - Langford': {
    categories: [
      {
        name: 'Polite Coffee',
        items: [
          { name: 'Americano', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Blue Sky Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast in Bed Latte', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Cappuccino', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Caramel Two Step Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chai Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Cherry Crush Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Coconut Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Party Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Gingerbread Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hazelnut Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Chocolate', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Drip Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Hot Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Hot Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Irish Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Kyle House Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'London Fog', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Maroon Lagoon Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peppermint Mocha', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Snickerdoodle Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Breakfast',
        items: [
          { name: 'Bagel with Cream Cheese', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Breakfast Sandwich', description: 'Build your own Breakfast Sandwich just how you like it! Choose your bread, protein, egg or egg white, and add cheese!', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Fresh Seasonal Fruit', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Power Protein Bagel', description: 'Peanut Butter, Sliced Banana, and Honey Drizzle on a Wheat Bagel', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
        ],
      },
      {
        name: 'Salad and Soups',
        items: [
          { name: 'Azimuth Club Salad', description: 'Turkey, Ham, Bacon, Cheddar Cheese, Tomato, Red Onion, Carrots, and Cucumbers over Mixed Greens and served with Ranch Dressing', portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Classic Chicken Salad', description: 'Grilled Chicken, Smoked Gouda, Bacon, Tomato, and Cucumbers over Mixed Greens and served with Balsamic Vinaigrette', portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Soup of the Day', description: 'Changes Daily', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Wraps',
        items: [
          { name: 'Garden Hummus Wrap', description: 'Mixed Greens, Tomato, Red Onion, Carrots, Celery, Cucumber, and Creamy Red Pepper Aioli rolled into a Spinach Tortilla Wrap', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Avocado Wrap', description: 'Grilled Chicken, Bacon, Avocado, Mixed Greens, Tomato, and Ranch Dressing rolled into a Spinach Wrap', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Desserts',
        items: [
          { name: 'Blueberry White Chocolate Cheese Cake', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Italian Creme Cake', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'NY Cheesecake Slice', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Tres Leches Cake Slice', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
        ],
      },
      {
        name: 'Refreshers',
        items: [
          { name: 'Black Tea Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Creamy Coconut Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Dragon-Strawberry Green Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Dragon-Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pina Colada Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Pineapple Strawberry Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Salted Caramel Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Thai Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Tropical Pineapple Splash', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Cold Sandwiches',
        items: [
          { name: 'BBQ Ranch Chicken', description: 'Grilled Chicken, BBQ Sauce, Red Onion, Lettuce, Tomato, and Creamy Ranch on Country White Bread', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Southwest Turkey', description: 'Smoked Turkey, Pepper-Jack Cheese, Lettuce, Tomato, and Chipotle Mayo on Country White Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Bacon Avocado', description: 'Sliced Turkey, Bacon, Smoked Gouda, Avocado, Lettuce, Fresh Tomato, and Mayo on Country White Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Spinach Herb', description: 'Smoked Turkey, Spinach, Pickled Red Onion, Herb Mayo, and Smoked Gouda On Wheat Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Grilled Sandwiches',
        items: [
          { name: 'Chicken Cheesy Jalapeno', description: 'Smoked Chicken, Tomato, Pepper Jack Cheese, and Creamy Jalapeno Ranch on Jalapeno Cheddar Bread', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Chipotle Turkey Melt', description: 'Sliced Turkey, Bacon, Cheddar Cheese, and Chipotle Mayo on Toasted Ciabatta Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Country Grilled Cheese', description: 'Sliced Cheddar, Fresh Tomato, and Bacon on Toasted Ciabatta Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Create Your Own', description: 'Create your own Sandwich just how you want it! Pick your Protein, Bread, Cheese, Spreads, and Toppings!', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Caprese', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Manzo', description: 'In-House Roast Beef, Swiss cheese,  Red Onion, and Pesto on Ciabatta Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tex-Mex Grilled Cheese', description: 'Melted Pepper-Jack Cheese, Avocado, Tomato, and Bacon on Toasted White Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tuscan Chicken', description: 'Grilled Chicken, Pesto Sauce, and Mozzarella Cheese on Toasted Ciabatta Bread', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Uptown Roast Beef', description: 'In- House Roast Beef, Swiss Cheese, Red Pepper Aioli, Arugula, and Tomato on toasted Multigrain bread', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
        ],
      },
      {
        name: 'Bakery',
        items: [
          { name: 'Conchas', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Croissants and Pastries', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Muffins', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Azimuth Cafe include a small bag of chips and a medium fountain drink!',
      combos: [
        { name: 'BBQ Chicken Sandwich', value: 11.78 },
        { name: 'Tex Mex Grilled Cheese', value: 11.78 },
        { name: 'Country Grilled Cheese', value: 11.78 },
        { name: 'Southwest Turkey Sandwich', value: 11.78 },
        { name: 'Chipotle Turkey Melt', value: 12.18 },
        { name: 'Chicken Mediterranean Sandwich', value: 12.18 },
        { name: 'Tuscan Chicken Sandwich', value: 12.18 },
        { name: 'Tasty Turkey Wrap', value: 11.88 },
        { name: 'BBQ Ranch Chicken Sandwich', value: 11.88 },
        { name: 'Turkey Bacon Avocado Sandwich', value: 12.18 },
        { name: 'Turkey Spinach Herb Sandwich', value: 11.88 },
        { name: 'Manzo Sandwich', value: 12.13 },
        { name: 'Chicken Cheesy Jalapeno Sandwich', value: 11.78 },
        { name: 'Uptown Roast Beef', value: 12.13 },
      ],
    },
  },
  'Houston Street Subs - Polo Garage': {
    categories: [
      {
        name: 'Traditional',
        items: [
          { name: 'Basic Chicken', description: 'Chicken Breast, Mozzarella, Lettuce, Tomato, Red Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Buffalo Chicken', description: 'Roasted Chicken Breast, Provolone Cheese, Lettuce, Tomatoes, and spicy Buffalo sauce', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Classic Turkey', description: 'Sliced Turkey, Provolone, Lettuce, Tomato, Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Custom Sub', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Wrap', description: 'Chickpea Hummus, Spinach, Tomatoes, Onions, Cucumbers, and Tzatziki sauce wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian', description: 'Pepperoni, Ham, Salami, Provolone, Mayo, Lettuce, Tomatoes, Hot Pepper Relish, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Perfect Ham', description: 'Ham, Swiss Cheese, Lettuce, Tomato, and Honey Mustard', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Santa Fe', description: 'Roasted Chicken Breast, Pepper-Jack Cheese, Lettuce, Pico de Gallo, Avocado, and Chipotle Mayo', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Capri', description: 'Ham, Provolone, Banana Peppers, Lettuce, Tomato, Onions, and Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Clubs',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Ham, Bacon, Provolone, Lettuce, Tomatoes, and Tangy Chipotle Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cali Club', description: 'Turkey, Bacon, Shredded Lettuce, Sliced Tomatoes, and Creamy Avocado Ranch', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Kolaches and Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Chip Cookie', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Any 10" Sub Sandwich', value: 12.78 },
        { name: 'Any Chopped Salad', value: 12.78 },
      ],
    },
  },
  'Panda Express - Polo Garage': {
    categories: [
      {
        name: 'Sides',
        items: [
          { name: 'Chow Mein', description: 'Chow Mein', portion: '1 each', calories: 600, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fried Rice', description: 'Fried Rice', portion: '1 each', calories: 620, protein: 13, carbs: 82, fat: 16 },
          { name: 'Super Greens', description: 'A healthful medley of broccoli, kale, and cabbage.', portion: '7', calories: 90, protein: 9, carbs: 14, fat: 4 },
        ],
      },
      {
        name: 'Vegetables',
        items: [
          { name: 'Super Greens (Entree)', description: 'A healthful medley of broccoli, kale, and cabbage.', portion: '7 oz', calories: 90, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Chicken',
        items: [
          { name: 'Black Pepper Chicken', description: 'Marinated chicken, celery and onions in a bold black pepper sauce.', portion: '6.3oz', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Teriyaki Chicken', description: 'Grilled chicken thigh hand-sliced to order and served with teriyaki sauce', portion: '6oz', calories: 275, protein: 36, carbs: 14, fat: 10 },
          { name: 'Kung Pao Chicken', description: 'A Sichuan-inspired dish with chicken, peanuts and vegetables, finished with chili peppers.', portion: '6.7oz', calories: 320, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mushroom Chicken', description: 'A delicate combination of chicken, mushrooms and zucchini wok-tossed with a light ginger soy sauce.', portion: '5.7oz', calories: 220, protein: 16, carbs: 10, fat: 12 },
          { name: 'Teriyaki Chicken', description: null, portion: '6oz', calories: 340, protein: 36, carbs: 14, fat: 10 },
          { name: 'The Original Orange Chicken®', description: 'Our signature dish. Crispy chicken wok-tossed in a sweet and spicy orange sauce.', portion: '5.9oz', calories: 510, protein: 26, carbs: 53, fat: 24 },
        ],
      },
      {
        name: 'Chicken Breast',
        items: [
          { name: 'Honey Sesame Chicken Breast', description: 'Honey Sesame Chicken Breast', portion: '1 each', calories: 340, protein: 10, carbs: 30, fat: 10 },
          { name: 'String Bean Chicken Breast', description: 'Chicken breast, string beans and onions wok-tossed in a mild ginger soy sauce.', portion: '5.6oz', calories: 210, protein: 14, carbs: 16, fat: 11 },
          { name: 'Sweet & Sour Chicken Breast', description: 'sweet & sour chicken breast', portion: '5.5oz', calories: 300, protein: 10, carbs: 40, fat: 10 },
          { name: 'SweetFire Chicken Breast®', description: 'Crispy, white-meat chicken, red bell peppers, onions and pineapples in a bright and sweet chili sauce.', portion: '5.8oz', calories: 360, protein: 15, carbs: 47, fat: 15 },
        ],
      },
      {
        name: 'Beef',
        items: [
          { name: 'Beijing Beef®', description: 'Crispy beef, bell peppers and onions in a sweet-tangy sauce.', portion: '5.6oz', calories: 480, protein: 10, carbs: 30, fat: 10 },
          { name: 'Black Pepper Sirloin Steak', description: 'Angus steak wok-seared with baby broccoli, onions, red bell peppers and mushrooms in a savory black pepper sauce.', portion: '5.1oz', calories: 210, protein: 19, carbs: 16, fat: 10 },
          { name: 'Broccoli Beef', description: 'A classic favorite. Tender beef and fresh broccoli in a ginger soy sauce.', portion: '5.4oz', calories: 150, protein: 11, carbs: 13, fat: 7 },
        ],
      },
      {
        name: 'Seafood',
        items: [
          { name: 'Honey Walnut Shrimp', description: 'Large tempura-battered shrimp, wok-tossed in a honey sauce and topped with glazed walnuts.', portion: '4.39oz', calories: 430, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Appetizers',
        items: [
          { name: 'Chicken Egg Roll', description: 'Cabbage, carrots, green onions and chicken in a crispy wonton wrapper.', portion: '2.75oz/1 roll', calories: 200, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cream Cheese Rangoon', description: 'Wonton wrappers filled with cream cheese and served with sweet and sour sauce.', portion: '2.4oz/3pcs', calories: 190, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vegetable Spring Roll', description: 'Cabbage, celery, carrots, green onions and Chinese noodles in a crispy wonton wrapper.', portion: '3.5oz/2 rolls', calories: 240, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Soup',
        items: [
          { name: 'Hot & Sour Soup (Cup)', description: 'Hot & Sour Soup', portion: '12.2oz', calories: 120, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'More',
        items: [
          { name: 'Fortune Cookie', description: 'Fortune Cookie', portion: '5g/1 pc', calories: 20, protein: 10, carbs: 30, fat: 10 },
          { name: 'Soy Sauce', description: null, portion: '0.21oz', calories: 5, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sweet & Sour Sauce', description: 'Sweet & Sour Sauce', portion: '1.8oz', calories: 70, protein: 10, carbs: 30, fat: 10 },
          { name: 'Teriyaki Sauce', description: 'Teriyaki Sauce', portion: '1.8oz', calories: 70, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Panda Express include the choice of a 16.9 oz. bottled water or a medium fountain drink!',
      combos: [
        { name: 'Orange Chicken Bowl', value: 10.2 },
        { name: 'Kung Pao Chicken Bowl', value: 10.2 },
        { name: 'Teriyaki Chicken Bowl', value: 10.2 },
        { name: 'Broccoli Beef Bowl', value: 10.2 },
        { name: 'Beijing Beef Bowl', value: 10.2 },
      ],
    },
  },
  'Salata': {
    categories: [
    ],
  },
  'Shake Smart - Polo Garage': {
    categories: [
      {
        name: 'Protein Balls',
        items: [
          { name: 'Cookie Dough', description: null, portion: '1 ball', calories: 134, protein: 10, carbs: 30, fat: 10 },
          { name: 'Magic Matcha', description: null, portion: '1 ball', calories: 142, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Craft Your Cup',
        items: [
          { name: 'Classic Oatmeal Base - no agave', description: null, portion: '1 serving', calories: 160, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Oatmeal Base - with agave', description: null, portion: '1 serving', calories: 202, protein: 10, carbs: 30, fat: 10 },
          { name: 'Overnight Oats Base - no agave', description: null, portion: '1 serving', calories: 180, protein: 10, carbs: 30, fat: 10 },
          { name: 'Overnight Oats Base - with agave', description: null, portion: '1 serving', calories: 222, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Classic Shakes',
        items: [
          { name: 'Chocolate Frosty - 1/2 agave', description: 'regular shakes (bases off non-fat milk/whey protein)', portion: '1 Shake', calories: 215, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Frosty - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies n\' Cream - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 225, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies n\' Cream - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 270, protein: 10, carbs: 30, fat: 10 },
          { name: 'Shake Your Coffee - 1/2 agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 163, protein: 10, carbs: 30, fat: 10 },
          { name: 'Shake Your Coffee with agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 211, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Smoothie', description: 'Sweetened fruit puree blended with ice.', portion: '12 oz cup', calories: 100, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Thrilla - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 205, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Trilla - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 250, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Specialty Shakes',
        items: [
          { name: 'Banana Split - 1/2 agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 227, protein: 10, carbs: 30, fat: 10 },
          { name: 'Banana Split - no agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 185, protein: 10, carbs: 30, fat: 10 },
          { name: 'Banana Split - with agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 269, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - 1/2 agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 323, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - no agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 275, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - with agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 371, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared - 1/2 agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared - no agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 258, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared with agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 342, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - 1/2 agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Sheake', calories: 192, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - no agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 150, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - with agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 234, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Blended Bowls',
        items: [
          { name: 'Dragon Bowl Base - 1/2 agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 239, protein: 10, carbs: 30, fat: 10 },
          { name: 'Dragon Bowl Base - no agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 197, protein: 10, carbs: 30, fat: 10 },
          { name: 'Dragon Bowl Base with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein, Topped with Granola, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 281, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base - 1/2 agave', description: 'Organic Acai, Strawberry, Apple Juice, Protein, Topped with Granola and Banana Slices', portion: '1 Bowl', calories: 382, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base - no agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 240, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base with agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 324, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base - 1/2 agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 391, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base - no agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 346, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base with agave', description: 'Organic Acai, Banana, Peanut Butter, Almond Milk, Protein, Topped with Granola and Cacao', portion: '1 Bowl', calories: 436, protein: 10, carbs: 30, fat: 10 },
          { name: 'Raw-cai', description: 'Scoops of Organic Acai, Strawberry, Topped with Granola, Banana Slices, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 346, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tropicali', description: 'Organic Acai, Pineapple, OJ, Protein, Topped with Granola and Coconut Flakes', portion: '1 Bowl', calories: 385, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'All Natural Sandwiches',
        items: [
          { name: 'Almond Butter Sandwich', description: 'on whole wheat thin bread with bananas', portion: '1 sandwich', calories: 352, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut Butter Sandwich', description: 'on whole wheat thin bread with banana slices', portion: '1 sandwich', calories: 342, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Whole Wheat Wraps',
        items: [
          { name: 'BBQ Turkey', description: 'turkey, bbq sauce, spinach, onions', portion: '1 Wrap', calories: 492, protein: 10, carbs: 30, fat: 10 },
          { name: 'BBQ Turkey with cheese', description: 'Turkey, BBQ Sauce, Spinach, Onion, Provolone', portion: '1 Wrap', calories: 590, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cran-Turkey', description: 'Turkey, Cranberry Mustard, Spinach, Onion', portion: '1 Wrap', calories: 437, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cran-Turkey with cheese', description: 'turkey, cranberry mustard, spinach, onions, provolone cheese', portion: '1 Wrap', calories: 535, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Tuna', description: 'tuna, habanero mustard, onions, spinach', portion: '1 Wrap', calories: 483, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Tuna with cheese', description: 'Tuna, Habanero Mustard, Onion, Spinach, Swiss', portion: '1 Wrap', calories: 589, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Pesto', description: 'turkey, pesto, spinach, onions, sun dried tomatoes', portion: '1 Wrap', calories: 555, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Pesto with cheese', description: 'Turkey, Pesto, Spinach, Onion, Sun Dried Tomatoes, Swiss cheese', portion: '1 Wrap', calories: 661, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight', description: 'spinach, dijon mustard, hummus, sun dried tomatoes, artichoke, cucumber', portion: '1 Wrap', calories: 343, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight with cheese', description: 'Spinach, Dijon Mustard, Hummus, Sun Dried Tomatoes, Swiss', portion: '1 Wrap', calories: 568, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Greens and Veggies',
        items: [
          { name: 'Carrot Cake - 1/2 agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 195, protein: 10, carbs: 30, fat: 10 },
          { name: 'Carrot Cake - no agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 153, protein: 10, carbs: 30, fat: 10 },
          { name: 'Carrot Cake - with agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green Tea Matcha - 1/2 agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 172, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green Tea Matcha - with agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go - 1/2 agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 194, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go - no agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 152, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go with agave', description: 'spinach, banana, pineapple, orange juice, protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Greens To Go - with agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Mentality 1/2 agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 172, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Mentality with agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - 1/2 agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - no agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 258, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - with agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 342, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Scooped Bowls',
        items: [
          { name: 'Raw-PB Base', description: 'Scoops of Organic Acai, Topped with Granola, Banana Slices, Dark Chocolate, and Peanut Butter', portion: '1 Bowl', calories: 305, protein: 10, carbs: 30, fat: 10 },
          { name: 'Raw-PB Base with agave', description: 'scoops of organic acai, topped with granola, banana slices, dark chocolate, and organic peanut butter', portion: '1 Bowl', calories: 353, protein: 10, carbs: 30, fat: 10 },
          { name: 'Rawçaí Base', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 269, protein: 10, carbs: 30, fat: 10 },
          { name: 'Rawçaí Base with agave', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 221, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Buzz Bowl Base', description: 'Scoops of Organic Acai, Pitaya, Pineapple, Strawberry, Topped with Granola, Coconut Flakes, and Bee Pollen', portion: '1 Bowl', calories: 242, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Buzz Bowl Base with agave', description: 'scoops of organic acai, pitaya, pineapple, topped with granola, bee pollen, and coconut flakes', portion: '1 Bowl', calories: 290, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Exotic Shake',
        items: [
          { name: 'A Perfect 10 - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 318, protein: 10, carbs: 30, fat: 10 },
          { name: 'A Perfect 10 - no agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 276, protein: 10, carbs: 30, fat: 10 },
          { name: 'A Perfect 10 - with agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 360, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy - 1/2 agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 378, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy - no agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 336, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy with agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 420, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast To Go - 1/2 agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 241, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast To Go - no agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 199, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast to Go - agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 283, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 229, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 271, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry - agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 313, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia - 1/2 agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 245, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia - no agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 203, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia with agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 287, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha - 1/2 agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 256, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha - no agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 214, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha with agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 298, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac - 1/2 agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 239, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac - no agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 197, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 281, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Smart Toast',
        items: [
          { name: 'Almond butter toast no agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 307, protein: 10, carbs: 30, fat: 10 },
          { name: 'Almond butter toast with agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 317, protein: 10, carbs: 30, fat: 10 },
          { name: 'Avocado toast', description: 'organic whole grain bread, avocado mash, feta cheese, sun dried tomatoes, crushed red pepper, crystalized lemon, himalayan sea salt', portion: '1', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut butter toast no agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 295, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut butter toast with agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 305, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'PourOver',
        items: [
          { name: 'Coldbrew', description: 'choice of milk, add protein, matcha or cinnamon', portion: '1', calories: 30, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green tea matcha', description: 'choice of milk, add protein', portion: '1', calories: 150, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'Shake Smart Maroon Meal options.',
      combos: [
        { name: 'Regular Size Shake with Choice of Milk', value: 8.74 },
        { name: 'Scooped or Blended Acai Bowl', value: 10.27 },
        { name: 'Smart Toast', value: 7.94 },
      ],
    },
  },
  'Starbucks Coffee - Zachry': {
    categories: [
    ],
  },
  'Reynolds and Reynolds Cafe': {
    categories: [
      {
        name: 'Polite Coffee',
        items: [
          { name: 'Americano', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Blue Sky Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast in Bed Latte', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Cappuccino', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Caramel Two Step Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chai Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Cherry Crush Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Coconut Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cranberry Rosemary Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Drip Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Garden Party Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Gingerbread Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hazelnut Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Chocolate', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Hot Tea Latte', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Iced Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Irish Cream Cold Brew', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Kyle House Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'London Fog', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Maroon Lagoon Giddy-Up', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Snickerdoodle Latte', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Refreshers',
        items: [
          { name: 'Black Tea Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Creamy Coconut Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Dragon-Strawberry Green Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Dragon-Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pina Colada Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Pineapple Strawberry Smoothie', description: null, portion: '—', calories: 350, protein: 10, carbs: 60, fat: 5 },
          { name: 'Salted Caramel Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Strawberry Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Thai Milk Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Tropical Pineapple Splash', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
  },
  'ILSQ Food Truck': {
    categories: [
    ],
  },
  'Chick-fil-A - West Campus Food Hall': {
    categories: [
      {
        name: 'Entrees',
        items: [
          { name: '12 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '12 Count', calories: 390, protein: 10, carbs: 30, fat: 10 },
          { name: '8 ct. Chick-fil-A Nuggets', description: 'Bite-sized pieces of boneless chicken breast, seasoned to perfection, freshly-breaded and pressure cooked in 100% refined peanut oil.', portion: '8 Count', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-A® Chicken Sandwich', description: 'A boneless breast of chicken seasoned to perfection, hand-breaded, pressure cooked in 100% refined peanut oil and served on a toasted, buttered bun with dill pickle chips.', portion: '1 each', calories: 440, protein: 29, carbs: 41, fat: 18 },
          { name: 'Chicken Sandwich', description: null, portion: '1 each', calories: 420, protein: 10, carbs: 30, fat: 10 },
          { name: 'Deluxe Sandwich', description: null, portion: '1 each', calories: 490, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Chicken Club Sandwich', description: null, portion: '1 each', calories: 520, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Chicken Sandwich', description: 'A lemon-herb marinated boneless breast of chicken, grilled for a tender and juicy backyard-smokey taste, served on a toasted Multigrain Brioche bun with Green Leaf lettuce and tomato.', portion: '1 each', calories: 380, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Nuggets', description: null, portion: '8 ct', calories: 130, protein: 10, carbs: 30, fat: 10 },
          { name: 'Nuggets', description: null, portion: '8 ct', calories: 250, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Chicken Sandwich', description: null, portion: '1 each', calories: 450, protein: 28, carbs: 43, fat: 19 },
          { name: 'Spicy Deluxe Sandwich', description: null, portion: '1 each', calories: 540, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Cobb Salad', description: null, portion: '1 each', calories: 690, protein: 10, carbs: 30, fat: 10 },
          { name: 'Market Salad', description: null, portion: '1 each', calories: 550, protein: 28, carbs: 41, fat: 31 },
          { name: 'Spicy Southwest Salad', description: null, portion: '1 each', calories: 680, protein: 33, carbs: 37, fat: 27 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Berry Parfait', description: null, portion: '1 each', calories: 270, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-a Sauce Flavored Waffle Potato Chips', description: null, portion: '1 each', calories: 210, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruit Cup', description: null, portion: '1 each', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Kale Crunch Side', description: null, portion: '1 each', calories: 170, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mac & Cheese', description: null, portion: 'Medium', calories: 450, protein: 16, carbs: 29, fat: 29 },
          { name: 'Original Flavor Waffle Potato Chips', description: null, portion: '1 bag', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Side Salad', description: null, portion: '1 each', calories: 470, protein: 10, carbs: 30, fat: 10 },
          { name: 'Waffle Potato Fries', description: null, portion: 'Medium', calories: 420, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Treats',
        items: [
          { name: 'Chocolate Chunk Cookie', description: null, portion: '1 each', calories: 370, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Fudge Brownie', description: null, portion: '1 each', calories: 370, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Milkshake', description: null, portion: '1 each', calories: 600, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies & Cream Milkshake', description: null, portion: '1 each', calories: 630, protein: 10, carbs: 30, fat: 10 },
          { name: 'Frosted Coffee', description: null, portion: '1 each', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Frosted Lemonade', description: null, portion: '1 each', calories: 350, protein: 10, carbs: 30, fat: 10 },
          { name: 'Frosted Lemonade w/ Diet Lemonade', description: null, portion: '1 each', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Icedream Cone', description: null, portion: '1 each', calories: 180, protein: 10, carbs: 30, fat: 10 },
          { name: 'Icedream Cup', description: null, portion: '1 each', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Milkshake', description: null, portion: '1 each', calories: 560, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Milkshake', description: null, portion: '1 each', calories: 580, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Chick-fil-A® Diet Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water. Diet Lemonade is sweetened with Splenda® No Calorie Sweetener.', portion: 'Medium', calories: 50, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-A® Lemonade', description: 'Classic lemonade using three simple ingredients: real lemon juice—not from concentrate, cane sugar, and water.', portion: 'Medium', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Coffee', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'DASANI® Bottled Water', description: 'DASANI® combines the process of reverse osmosis filtration with a proprietary blend of minerals to create fresh, clean, and premium tasting water that is pure and delicious.', portion: '1 bottle', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Diet Lemonade', description: null, portion: 'Medium', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Iced Coffee', description: null, portion: '—', calories: 200, protein: 10, carbs: 30, fat: 10 },
          { name: 'Iced Tea Sweetened', description: null, portion: 'Medium', calories: 12, protein: 10, carbs: 30, fat: 10 },
          { name: 'Iced Tea Unsweetened', description: null, portion: 'Medium', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Lemonade', description: null, portion: 'Medium', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sunjoy', description: null, portion: 'Medium', calories: 240, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Iced Coffee', description: null, portion: '—', calories: 200, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dipping Sauces',
        items: [
          { name: 'Barbecue Sauce', description: 'Barbecue Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Barbeque Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-A® Sauce', description: 'Chick-Fil-A Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chick-fil-a Sauce', description: null, portion: '1 each', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Sauce', description: 'Garden Herb Ranch Sauce', portion: '1 packet', calories: 140, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Ranch Sauce', description: null, portion: '1 each', calories: 100, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Mustard Sauce', description: 'Honey Mustard Sauce', portion: '1 packet', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Honey Roasted BBQ Sauce', description: 'Honey Roasted BBQ Sauce', portion: '1 packet', calories: 60, protein: 10, carbs: 30, fat: 10 },
          { name: 'Polynesian Sauce', description: 'Polynesian Sauce', portion: '1 packet', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Sweet & Spicy Sriracha Sauce', description: null, portion: '1 each', calories: 45, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Buffalo Sauce', description: 'Buffalo Sauce', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Dressings',
        items: [
          { name: 'Avocado Lime Ranch Dressing', description: null, portion: '1 each', calories: 310, protein: 10, carbs: 30, fat: 10 },
          { name: 'Creamy Salsa Dressing', description: null, portion: '1 each', calories: 290, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat Free Honey Mustard Dressing', description: 'Fat Free Honey Mustard Dressing', portion: '1 packet', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fat-Free Honey Mustard Dressing', description: null, portion: '1 each', calories: 90, protein: 10, carbs: 30, fat: 10 },
          { name: 'Garden Herb Ranch Dressing', description: null, portion: '1 each', calories: 280, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Balsamic Vinaigrette Dressing', description: 'Light Balsamic Vinaigrette Dressing', portion: '1 packet', calories: 80, protein: 10, carbs: 30, fat: 10 },
          { name: 'Light Italian Dressing', description: 'Light Italian Dressing', portion: '1 packet', calories: 25, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mayonnaise', description: 'creamy', portion: '1 Tbsp', calories: 110, protein: 10, carbs: 30, fat: 10 },
          { name: 'Zesty Apple Cider Vinaigrette Dressing', description: null, portion: '1 each', calories: 230, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!',
      combos: [
        { name: 'Original Chicken Sandwich', value: 9.49 },
        { name: 'Spicy Chicken Sandwich', value: 9.79 },
        { name: '8 Piece Chicken Nuggets', value: 9.59 },
        { name: 'Avoiding Gluten - Grilled Chicken Sandwich', value: 9.49 },
      ],
    },
  },
  'Copperhead Jack\'s - West Campus Food Hall': {
    categories: [
      {
        name: 'Quesadillas',
        items: [
          { name: 'Diced Veggie Quesadilla', description: null, portion: '—', calories: 300, protein: 29, carbs: 41, fat: 18 },
          { name: 'Grilled Chicken Quesadilla', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grilled Steak Quesadilla', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Tacos',
        items: [
          { name: 'Diced Veggie Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Steak Tacos', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Burritos',
        items: [
          { name: 'Diced Veggie Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Chicken Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Grilled Steak Burrito', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Bowls',
        items: [
          { name: 'Diced Veggie Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Grilled Chicken Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Grilled Steak Bowl', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'Mini Bowls', description: null, portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chips and Guacamole', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Chips and Queso', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Chips and Salsa', description: null, portion: '—', calories: 380, protein: 5, carbs: 45, fat: 18 },
          { name: 'Tortillas', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Copperhead Jack\'s include the choice of a 16.9 oz bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Build Your Own Burrito', value: 11.48 },
        { name: 'Build Your Own Bowl', value: 11.98 },
      ],
    },
  },
  'Spin n\' Stone Pizza - Creekside Market': {
    categories: [
    ],
  },
  'Health Science Center Cafe': {
    categories: [
      {
        name: 'Breakfast',
        items: [
          { name: 'Aggie Classic', description: 'Bagel topped with Egg, Bacon, Ham, Cheddar, Black Pepper, and Plain Cream Cheese', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'BYO Breakfast Sandwich', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Bagel and Cream Cheese', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Presidential', description: 'Bagel topped with Egg Whites, Tomatoes, Fresh Spinach, and Plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Deli Favorites',
        items: [
          { name: 'BYO Deli Sandwich', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Executive Grilled Cheese', description: 'Toasted Bread topped with Cheddar, Provolone, Plain Cream Cheese, Tomatoes, and Red Onions', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Italian Chicken', description: 'Choice of Bread topped with Chicken, Pepperoni, Provolone, Red Onion, Spinach, and Tomato Basil Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'The Diplomat', description: 'Choice of Bread topped with Turkey, Spinach, Cucumber, Lettuce, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Pizza Bagels',
        items: [
          { name: 'Cheese Pizza Bagel', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Pepperoni Pizza Bagel', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
        ],
      },
    ],
  },
  'Houston Street Deli - RELLIS': {
    categories: [
      {
        name: 'Breakfast',
        items: [
          { name: 'Aggie Classic', description: 'Choice of Bagel topped with Plain Cream Cheese Spread, Egg, Cheddar Cheese, Thick Cut Bacon, Smoked Ham, and Black Pepper', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'Avocado Toast', description: 'Toasted Plain Bagel with Fresh Avocado Spread and Salt and Pepper', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'BYO Breakfast Sandwich', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Bagel and Cream Cheese', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bruschetta Bagel', description: 'Bagel topped with Hummus, Sliced Tomato, Fresh Spinach, and Provolone', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Fresh Seasonal Fruit', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hungry Howdy', description: 'Plain Bagel topped with an Egg, American Cheese, Bacon, and Jalapeno Salsa Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Muffins', description: 'Freshly baked muffin in your flavor of choice!', portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Power Protein Bagel', description: 'Bagel with Peanut Butter, Fresh Banana, and Honey Drizzle', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Presidential', description: 'A Toasted Plain Bagel with Egg Whites, Sliced Tomato, Fresh Spinach, and Plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Melts and Pizzas',
        items: [
          { name: 'Cheese Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Executive Grilled Cheese', description: 'Choice of Bread with melted Cheddar, Provolone, Plain Cream Cheese, Sliced Tomato, and Red Onion', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Italian Chicken', description: 'Choice of Bread with Chicken, Pepperoni, Provolone, Red Onion, Spinach, and Tomato Basil Cream Cheese Spread', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Pepperoni Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Spicy Chicken', description: 'Choice of Bread with Chicken, Bacon, Cheddar,  Sliced Jalapenos, Red Onion, and Jalapeno Salsa Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Veggie Pizza', description: null, portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
        ],
      },
      {
        name: 'Deli',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Lettuce, Tomato, Bacon, & Tomato Basil Cream Cheese Spread on your Choice of Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'BYO Deli Sandwich', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'The Diplomat', description: 'Turkey, Spinach, Cucumber, Lettuce, and Onion & Chive Cream Cheese Spread on your Choice of Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight', description: 'Tomato, Cucumber, Red Onion, Spinach, Lettuce, and Veggie Cream Cheese Spread on your choice of Bread', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Frappuccino', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Bubly Sparkling Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Celsius Energy Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Diet Pepsi Bottle', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Drip Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Gatorade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Hot Tea', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Lemonade', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Orange Juice', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pepsi Bottle', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Red Bull Blueberry', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Red Bull Sugar Free', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Starbucks Double Shot Energy', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'Listed Maroon Meals are available at Houston Street Deli on the RELLIS campus.',
      combos: [
        { name: 'Build Your Own Bagel Sandwich (1 or 2 Eggs) with Piece of Fruit and Choice of Bottled Water or Drip Coffee', value: 8.97 },
        { name: 'Build Your Own Melt with Choice of Chips and Beverage', value: 10.68 },
      ],
    },
  },
  'Houston Street Subs - West Campus Food Hall': {
    categories: [
      {
        name: 'Traditional',
        items: [
          { name: 'Basic Chicken', description: 'Chicken Breast, Mozzarella, Lettuce, Tomato, Red Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Buffalo Chicken', description: 'Roasted Chicken Breast, Provolone Cheese, Lettuce, Tomatoes, and spicy Buffalo sauce', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Classic Turkey', description: 'Sliced Turkey, Provolone, Lettuce, Tomato, Onion, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Custom Sub', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hummus Wrap', description: 'Chickpea Hummus, Spinach, Tomatoes, Onions, Cucumbers, and Tzatziki sauce wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Italian', description: 'Pepperoni, Ham, Salami, Provolone, Mayo, Lettuce, Tomatoes, Hot Pepper Relish, and drizzled with Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Perfect Ham', description: 'Ham, Swiss Cheese, Lettuce, Tomato, and Honey Mustard', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Santa Fe', description: 'Roasted Chicken Breast, Pepper-Jack Cheese, Lettuce, Pico de Gallo, Avocado, and Chipotle Mayo', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Capri', description: 'Ham, Provolone, Banana Peppers, Lettuce, Tomato, Onions, and Oil and Vinegar', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Clubs',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Ham, Bacon, Provolone, Lettuce, Tomatoes, and Tangy Chipotle Sauce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Cali Club', description: 'Turkey, Bacon, Shredded Lettuce, Sliced Tomatoes, and Creamy Avocado Ranch', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
        ],
      },
      {
        name: 'Kolaches and Sides',
        items: [
          { name: 'Chips', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Chip Cookie', description: null, portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Bottled Water', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.',
      combos: [
        { name: 'Any 10" Sub Sandwich', value: 12.78 },
        { name: 'Any Chopped Salad', value: 12.78 },
      ],
    },
  },
  'Shake Smart- Rec Center': {
    categories: [
      {
        name: 'Protein Balls',
        items: [
          { name: 'Cookie Dough', description: null, portion: '1 ball', calories: 134, protein: 10, carbs: 30, fat: 10 },
          { name: 'Magic Matcha', description: null, portion: '1 ball', calories: 142, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Craft Your Cup',
        items: [
          { name: 'Classic Oatmeal Base - no agave', description: null, portion: '1 serving', calories: 160, protein: 10, carbs: 30, fat: 10 },
          { name: 'Classic Oatmeal Base - with agave', description: null, portion: '1 serving', calories: 202, protein: 10, carbs: 30, fat: 10 },
          { name: 'Overnight Oats Base - no agave', description: null, portion: '1 serving', calories: 180, protein: 10, carbs: 30, fat: 10 },
          { name: 'Overnight Oats Base - with agave', description: null, portion: '1 serving', calories: 222, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Classic Shakes',
        items: [
          { name: 'Chocolate Frosty - 1/2 agave', description: 'regular shakes (bases off non-fat milk/whey protein)', portion: '1 Shake', calories: 215, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Frosty - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies n\' Cream - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 225, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cookies n\' Cream - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 270, protein: 10, carbs: 30, fat: 10 },
          { name: 'Shake Your Coffee - 1/2 agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 163, protein: 10, carbs: 30, fat: 10 },
          { name: 'Shake Your Coffee with agave', description: 'vanilla or chocolate protein, extras available', portion: '1 cup', calories: 211, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Smoothie', description: 'Sweetened fruit puree blended with ice.', portion: '12 oz cup', calories: 100, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Thrilla - 1/2 agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 205, protein: 10, carbs: 30, fat: 10 },
          { name: 'Vanilla Trilla - with agave', description: 'regular shakes (based off non-fat milk/whey protein)', portion: '1 Shake', calories: 250, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Specialty Shakes',
        items: [
          { name: 'Banana Split - 1/2 agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 227, protein: 10, carbs: 30, fat: 10 },
          { name: 'Banana Split - no agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 185, protein: 10, carbs: 30, fat: 10 },
          { name: 'Banana Split - with agave', description: 'Strawberry, Banana, Chocolate Protein', portion: '1 Shake', calories: 269, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - 1/2 agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 323, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - no agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 275, protein: 10, carbs: 30, fat: 10 },
          { name: 'Grammy\'s Goods - with agave', description: 'Cookies n\' Cream, Protein, Peanut Butter', portion: '1 Shake', calories: 371, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared - 1/2 agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared - no agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 258, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB Squared with agave', description: 'banana, chocolate protein, organic peanut butter', portion: '1 Shake', calories: 342, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - 1/2 agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Sheake', calories: 192, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - no agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 150, protein: 10, carbs: 30, fat: 10 },
          { name: 'Strawberry Fields - with agave', description: 'Strawberry and Vanilla Proteins', portion: '1 Shake', calories: 234, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Blended Bowls',
        items: [
          { name: 'Dragon Bowl Base - 1/2 agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 239, protein: 10, carbs: 30, fat: 10 },
          { name: 'Dragon Bowl Base - no agave', description: 'pitaya, pineapple, orange juice, vanilla protein, topped with granola, coconut flakes, and chia seeds', portion: '1 Bowl', calories: 197, protein: 10, carbs: 30, fat: 10 },
          { name: 'Dragon Bowl Base with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein, Topped with Granola, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 281, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base - 1/2 agave', description: 'Organic Acai, Strawberry, Apple Juice, Protein, Topped with Granola and Banana Slices', portion: '1 Bowl', calories: 382, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base - no agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 240, protein: 10, carbs: 30, fat: 10 },
          { name: 'Original Acai Bowl Base with agave', description: 'organic acai, strawberry, apple juice, protein, topped with granola, coconut flakes, and banana slices', portion: '1 Bowl', calories: 324, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base - 1/2 agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 391, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base - no agave', description: 'organic acai, strawberry, organic peanut butter, almond milk, protein, topped with granola, dark chocolate, and banana slices', portion: '1 Bowl', calories: 346, protein: 10, carbs: 30, fat: 10 },
          { name: 'PB&A Base with agave', description: 'Organic Acai, Banana, Peanut Butter, Almond Milk, Protein, Topped with Granola and Cacao', portion: '1 Bowl', calories: 436, protein: 10, carbs: 30, fat: 10 },
          { name: 'Raw-cai', description: 'Scoops of Organic Acai, Strawberry, Topped with Granola, Banana Slices, Chia, and Coconut Flakes', portion: '1 Bowl', calories: 346, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tropicali', description: 'Organic Acai, Pineapple, OJ, Protein, Topped with Granola and Coconut Flakes', portion: '1 Bowl', calories: 385, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'All Natural Sandwiches',
        items: [
          { name: 'Almond Butter Sandwich', description: 'on whole wheat thin bread with bananas', portion: '1 sandwich', calories: 352, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut Butter Sandwich', description: 'on whole wheat thin bread with banana slices', portion: '1 sandwich', calories: 342, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Whole Wheat Wraps',
        items: [
          { name: 'BBQ Turkey', description: 'turkey, bbq sauce, spinach, onions', portion: '1 Wrap', calories: 492, protein: 10, carbs: 30, fat: 10 },
          { name: 'BBQ Turkey with cheese', description: 'Turkey, BBQ Sauce, Spinach, Onion, Provolone', portion: '1 Wrap', calories: 590, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cran-Turkey', description: 'Turkey, Cranberry Mustard, Spinach, Onion', portion: '1 Wrap', calories: 437, protein: 10, carbs: 30, fat: 10 },
          { name: 'Cran-Turkey with cheese', description: 'turkey, cranberry mustard, spinach, onions, provolone cheese', portion: '1 Wrap', calories: 535, protein: 10, carbs: 30, fat: 10 },
          { name: 'Rubi\'s Tuna Salad', description: 'tuna, carrot, onion, celery, spinach, swiss', portion: '1 sandwich', calories: 529, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Tuna', description: 'tuna, habanero mustard, onions, spinach', portion: '1 Wrap', calories: 483, protein: 10, carbs: 30, fat: 10 },
          { name: 'Spicy Tuna with cheese', description: 'Tuna, Habanero Mustard, Onion, Spinach, Swiss', portion: '1 Wrap', calories: 589, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Pesto', description: 'turkey, pesto, spinach, onions, sun dried tomatoes', portion: '1 Wrap', calories: 555, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Pesto with cheese', description: 'Turkey, Pesto, Spinach, Onion, Sun Dried Tomatoes, Swiss cheese', portion: '1 Wrap', calories: 661, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turks & \'matoes', description: 'turkey, spinach, onion, sundried tomatoes, swiss', portion: '1 sandwich', calories: 496, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight', description: 'spinach, dijon mustard, hummus, sun dried tomatoes, artichoke, cucumber', portion: '1 Wrap', calories: 343, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight with cheese', description: 'Spinach, Dijon Mustard, Hummus, Sun Dried Tomatoes, Swiss', portion: '1 Wrap', calories: 568, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Greens and Veggies',
        items: [
          { name: 'Carrot Cake - 1/2 agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 195, protein: 10, carbs: 30, fat: 10 },
          { name: 'Carrot Cake - no agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 153, protein: 10, carbs: 30, fat: 10 },
          { name: 'Carrot Cake - with agave', description: 'Cinnamon, Banana, Carrot Juice, Vanilla Protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green Tea Matcha - 1/2 agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 172, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green Tea Matcha - with agave', description: 'Green Tea Matcha, Vanilla Protein', portion: '1 Shake', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go - 1/2 agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 194, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go - no agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 152, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green To Go with agave', description: 'spinach, banana, pineapple, orange juice, protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Greens To Go - with agave', description: 'Spinach, Banana, Pineapple, OJ, Protein', portion: '1 Shake', calories: 236, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Mentality 1/2 agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 172, protein: 10, carbs: 30, fat: 10 },
          { name: 'Matcha Mentality with agave', description: 'green tea matcha, vanilla protein', portion: '1 Shake', calories: 220, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - 1/2 agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - no agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 258, protein: 10, carbs: 30, fat: 10 },
          { name: 'Organic Supershake - with agave', description: 'Organic Superfood, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 342, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Scooped Bowls',
        items: [
          { name: 'Raw-PB Base', description: 'Scoops of Organic Acai, Topped with Granola, Banana Slices, Dark Chocolate, and Peanut Butter', portion: '1 Bowl', calories: 305, protein: 10, carbs: 30, fat: 10 },
          { name: 'Raw-PB Base with agave', description: 'scoops of organic acai, topped with granola, banana slices, dark chocolate, and organic peanut butter', portion: '1 Bowl', calories: 353, protein: 10, carbs: 30, fat: 10 },
          { name: 'Rawçaí Base', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 269, protein: 10, carbs: 30, fat: 10 },
          { name: 'Rawçaí Base with agave', description: 'scoops of organic acai, strawberry, topped with granola, banana slices, chia, and coconut flakes', portion: '1 Bowl', calories: 221, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Buzz Bowl Base', description: 'Scoops of Organic Acai, Pitaya, Pineapple, Strawberry, Topped with Granola, Coconut Flakes, and Bee Pollen', portion: '1 Bowl', calories: 242, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Buzz Bowl Base with agave', description: 'scoops of organic acai, pitaya, pineapple, topped with granola, bee pollen, and coconut flakes', portion: '1 Bowl', calories: 290, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Exotic Shake',
        items: [
          { name: 'A Perfect 10 - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 318, protein: 10, carbs: 30, fat: 10 },
          { name: 'A Perfect 10 - no agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 276, protein: 10, carbs: 30, fat: 10 },
          { name: 'A Perfect 10 - with agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 360, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy - 1/2 agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 378, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy - no agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 336, protein: 10, carbs: 30, fat: 10 },
          { name: 'Acai Energy with agave', description: 'acai, banana, vanilla protein, organic peanut butter', portion: '1 Shake', calories: 420, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast To Go - 1/2 agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 241, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast To Go - no agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 199, protein: 10, carbs: 30, fat: 10 },
          { name: 'Breakfast to Go - agave', description: 'Strawberry, Pineapple, Acai, OJ, Vanilla Protein', portion: '1 Shake', calories: 283, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 229, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry - 1/2 agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 271, protein: 10, carbs: 30, fat: 10 },
          { name: 'Chocolate Covered Strawberry - agave', description: 'Blueberry, Banana, Vanilla Protein, Peanut Butter', portion: '1 Shake', calories: 313, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia - 1/2 agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 245, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia - no agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 203, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fruitopia with agave', description: 'Strawberry, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 287, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha - 1/2 agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 256, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha - no agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 214, protein: 10, carbs: 30, fat: 10 },
          { name: 'Mea Aloha with agave', description: 'Pineapple, Banana, Acai, Apple Juice, Protein', portion: '1 Shake', calories: 298, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac - 1/2 agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 239, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac - no agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 197, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pink Cadillac with agave', description: 'Pitaya, Pineapple, OJ, Vanilla Protein', portion: '1 Shake', calories: 281, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Smart Toast',
        items: [
          { name: 'Almond butter toast no agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 307, protein: 10, carbs: 30, fat: 10 },
          { name: 'Almond butter toast with agave', description: 'organic whole grain bread, all natural almond butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 317, protein: 10, carbs: 30, fat: 10 },
          { name: 'Avocado toast', description: 'organic whole grain bread, avocado mash, feta cheese, sun dried tomatoes, crushed red pepper, crystalized lemon, himalayan sea salt', portion: '1', calories: 260, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut butter toast no agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 295, protein: 10, carbs: 30, fat: 10 },
          { name: 'Peanut butter toast with agave', description: 'organic whole grain bread, all natural peanut butter, bananas, hemp seeds, cinnamon', portion: '1', calories: 305, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'PourOver',
        items: [
          { name: 'Coldbrew', description: 'choice of milk, add protein, matcha or cinnamon', portion: '1', calories: 30, protein: 10, carbs: 30, fat: 10 },
          { name: 'Green tea matcha', description: 'choice of milk, add protein', portion: '1', calories: 150, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
    maroonMeals: {
      note: 'Shake Smart Maroon Meal options.',
      combos: [
        { name: 'Regular Size Shake with Choice of Milk', value: 8.74 },
        { name: 'Scooped or Blended Acai Bowl', value: 10.27 },
        { name: 'Smart Toast', value: 7.94 },
      ],
    },
  },
  'The 41st Club - Bush Library': {
    categories: [
      {
        name: 'Breakfast Favorites',
        items: [
          { name: 'Aggie Classic', description: 'Plain Bagel topped with Egg, Bacon, Ham, Cheddar, Black Pepper, & Plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Avocado Toast', description: 'Toasted Bagel with Fresh Avocado Spread, Salt, and Pepper', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'BYO Breakfast Sandwich', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Bagel and Cream Cheese', description: null, portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Bruschetta Bagel', description: 'Bagel with Hummus, Sliced Tomato, Fresh Spinach, and Provolone', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Hungry Aggie', description: 'Toasted plain bagel with 2 eggs, melted American cheese, bacon, & Jalapeno Salsa Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Power Protein Bagel', description: 'Bagel with Peanut Butter, Fresh Banana, and Honey Drizzle', portion: '—', calories: 280, protein: 10, carbs: 55, fat: 2 },
          { name: 'Sausage Kolaches', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'The Presidential', description: 'Bagel with Egg Whites, Tomatoes, Fresh Spinach, and Plain Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Deli Delights',
        items: [
          { name: 'Aggie Club', description: 'Turkey, Lettuce, Tomato, Bacon, & Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'BYO Bagel Sandwich', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Hungry Howdy', description: 'Ham, Turkey, Lettuce, Tomato, Red Onion, Provolone, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Cheddar', description: 'Turkey, Cheddar, Spinach, Cucumber, Lettuce, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Veggie Delight', description: 'Lettuce, Tomato, Cucumber, Red Onion, Spinach, and Veggie Cream Cheese', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
        ],
      },
      {
        name: 'Melts',
        items: [
          { name: 'BYO Deli Sandwich', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Executive Grilled Cheese', description: 'Cheddar, Provolone, Swiss Cheese, Plain Cream Cheese, Tomatoes, and Red Onions', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Flatbread Pizza', description: 'Choose between Cheese, Pepperoni, and Veggie', portion: '—', calories: 350, protein: 15, carbs: 35, fat: 15 },
          { name: 'Italian Chicken', description: 'Chicken, Pepperoni, Provolone, Red Onion, Spinach, and Roasted Tomato Spread', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'Spicy Chicken', description: 'Chicken, Bacon, Cheddar, Jalapeno, Red Onion, and Jalapeno Cream Cheese', portion: '—', calories: 450, protein: 30, carbs: 25, fat: 20 },
          { name: 'The Diplomat', description: 'Turkey, Spinach, Cucumber, Lettuce, and Herb Cream Cheese', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
    ],
  },
  'Vet Med Cafe': {
    categories: [
      {
        name: 'Breakfast',
        items: [
          { name: 'BYO Breakfast Sandwich', description: null, portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
          { name: 'BYO Breakfast Taco', description: null, portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Egg-cellent Bowl', description: 'Fried Egg, Chorizo, Diced Potato, Cheddar Cheese, Avocado, and Pico de Gallo served on top a bed of Fresh Sauteed Spinach', portion: '—', calories: 600, protein: 35, carbs: 65, fat: 20 },
          { name: 'French Toast Sticks and Sausage', description: '5 Crispy French Toast Sticks served with 2 Savory Breakfast Sausages', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Fresh Fruit', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Pancake on a Stick', description: '2 Savory Breakfast Sausages wrapped in Fluffy Pancakes and served with Maple Syrup', portion: '—', calories: 250, protein: 3, carbs: 35, fat: 12 },
          { name: 'Vet Supreme Breakfast', description: 'Your choice of Breakfast Protein served with Eggs, Toasty Hash Browns, and Pancakes', portion: '—', calories: 400, protein: 20, carbs: 25, fat: 25 },
        ],
      },
      {
        name: 'Burgers and Chicken',
        items: [
          { name: 'Buffalo Chicken Sandwich', description: 'Country Breaded Chicken Breast Patty smothered in Buffalo Sauce, Fresh Ranch, and Shredded Lettuce inside of a Toasted Bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Buffalo Chicken Wrap', description: 'Crispy Chicken, Buffalo Sauce, Shredded Cheese, Lettuce, and Ranch Dressing wrapped tightly in a Tortilla', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Fried Chicken Sandwich', description: 'Crispy Chicken Patty topped with Tomato and Lettuce', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Classic Hamburger', description: 'Classic Beef Hamburger Patty with Lettuce, Tomato, and Pickles in a Toasty Bun', portion: '—', calories: 650, protein: 30, carbs: 50, fat: 30 },
          { name: 'Patty Melt', description: 'Classic Beef Patty with Cheddar Cheese, BBQ Sauce, Mayo, and Grilled Onions sandwiched between two thick slices of Texas Toast', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tender Combo', description: '3 Crispy Chicken Tenders served with a side of French Fries and Dipping Sauce. Add a drink to make it a full meal!', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Grilled Paninis',
        items: [
          { name: 'Spicy Chicken Panini', description: 'Roasted Chicken Breast, Fresh Basil, Red Onion, Tomatoes, and Chipotle Mayo on Focaccia Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Turkey Bacon Ranch Panini', description: 'Roasted Turkey, Bacon, Cheddar Cheese and Ranch on Focaccia Bread', portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Salads',
        items: [
          { name: 'Crispy Chicken Salad', description: 'Sliced Chicken Tenders, Bacon, Celery, Tomato, Cheddar Cheese, and Creamy Ranch Dressing served over Fresh Mixed Greens', portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
          { name: 'Southwest Chop Salad', description: 'Roasted Chicken, Cucumbers, Avocado, Black Olives, Cheddar-Monterey Jack Cheese, and Pico de Gallo over a bed of Fresh Romaine Lettuce', portion: '—', calories: 300, protein: 15, carbs: 20, fat: 18 },
        ],
      },
      {
        name: 'Sides',
        items: [
          { name: 'French Fries', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Tater Tots', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Hot Tea', description: null, portion: '—', calories: 300, protein: 10, carbs: 30, fat: 10 },
          { name: 'Large Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Large Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Medium Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Regular Fountain Drink', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
          { name: 'Small Coffee', description: null, portion: '—', calories: 120, protein: 0, carbs: 30, fat: 0 },
        ],
      },
    ],
    maroonMeals: {
      note: 'All Maroon Meals at Vet Med Cafe include original fries and a medium fountain drink!',
      combos: [
        { name: 'Bacon Cheeseburger', value: 11.68 },
        { name: 'Original Cheeseburger', value: 10.68 },
        { name: 'Black Bean Burger (Vegetarian)', value: 10.58 },
        { name: 'Spicy Chicken Panini', value: 11.98 },
        { name: 'Turkey Bacon Ranch Panini', value: 11.98 },
        { name: '3 Piece Chicken Tenders', value: 8.49 },
      ],
    },
  },
};

/**
 * Look up a static restaurant menu by location name.
 * Tries exact match first, then case-insensitive partial match.
 */
export function getStaticRestaurantMenu(locationName: string): StaticRestaurantMenu | null {
  if (STATIC_RESTAURANT_MENUS[locationName]) return STATIC_RESTAURANT_MENUS[locationName];
  const lower = locationName.toLowerCase();
  for (const [key, menu] of Object.entries(STATIC_RESTAURANT_MENUS)) {
    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return menu;
    }
  }
  return null;
}
