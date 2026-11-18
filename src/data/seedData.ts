import muttonImg from '../assets/images/recipe_mutton_curry_1794567377270.jpg';
import chingriImg from '../assets/images/recipe_chingri_malai_1794567377635.jpg';
import biryaniImg from '../assets/images/recipe_chicken_biryani_1794567378232.jpg';
import alurDomImg from '../assets/images/recipe_alur_dom_1794567377865.jpg';
import ilishImg from '../assets/images/recipe_ilish_shorshe_1794567378922.jpg';
import mishtiImg from '../assets/images/recipe_bengali_mishti_1794567379192.jpg';
import stepMarinateImg from '../assets/images/step_marinate_spices_1794570856893.jpg';
import stepTemperImg from '../assets/images/step_tempering_oil_1794570856784.jpg';
import stepSimmerImg from '../assets/images/step_simmer_gravy_1794570856961.jpg';
import stepGarnishImg from '../assets/images/step_final_garnish_1794570856999.jpg';
import type {
  BlogPost,
  CookingTip,
  Recipe,
  RecipeCategory,
  RecipeContent,
  SiteSettings,
  SubscriptionPlan,
} from '../types';

export const STEP_GALLERY_IMAGES = [
  { label: 'মশলা ও ম্যারিনেশন (ধাপ)', url: stepMarinateImg },
  { label: 'তেলে ফোড়ন ও ভাজা (ধাপ)', url: stepTemperImg },
  { label: 'কষানো ও ঝোল ফোটানো (ধাপ)', url: stepSimmerImg },
  { label: 'পরিবেশন ও গার্নিশ (ধাপ)', url: stepGarnishImg },
  { label: 'মাটন কারি (সমাপ্ত)', url: muttonImg },
  { label: 'চিংড়ি মালাই কারি (সমাপ্ত)', url: chingriImg },
  { label: 'চিকেন বিরিয়ানি (সমাপ্ত)', url: biryaniImg },
  { label: 'আলুর দম (সমাপ্ত)', url: alurDomImg },
  { label: 'সরষে ইলিশ (সমাপ্ত)', url: ilishImg },
  { label: 'মিষ্টি দই ও রসমালাই (সমাপ্ত)', url: mishtiImg },
];

export const SEED_RECIPES: Array<{ recipe: Omit<Recipe, 'createdAt' | 'updatedAt'>; content: Omit<RecipeContent, 'updatedAt'> }> = [
  {
    recipe: {
      id: 'mutton-curry',
      title: 'একটি দুর্দান্ত মাটন কারি রেসিপি',
      subtitle: 'খাঁটি সরিষার তেল ও বাটা মশলায় ধীর আঁচে কষানো ঐতিহ্যবাহী খাসির মাংসের কারি।',
      imageUrl: muttonImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'নন-ভেজ',
      category: 'মাংসের রেসিপি',
      cookTime: '১ ঘন্টা ২০ মিনিট',
      prepTime: '৩০ মিনিট',
      difficulty: 'মাঝারি',
      servings: '৪ জন',
      rating: 4.9,
      ratingCount: 315,
      isPremium: true,
      isFeatured: true,
      orderIndex: 1,
    },
    content: {
      ingredients: [
        'খাসির মাংস — ১ কেজি (মাঝারি টুকরো)',
        'টক দই — ১৫০ গ্রাম (ফেটানো)',
        'পেঁয়াজ কুচি — ৪টি বড়',
        'আদা-রসুন বাটা — ৩ টেবিল চামচ',
        'কাঁচা পেঁপে বাটা — ১ টেবিল চামচ (মাংস নরম করার জন্য)',
        'সরিষার তেল — ৬ টেবিল চামচ',
        'শুকনো লাল মরিচ — ৪টি',
        'গরম মশলা গুঁড়ো ও আস্ত মশলা (তেজপাতা, এলাচ, দারুচিনি, লবঙ্গ)',
        'হলুদ, জিরা, ধনে ও কাশ্মীরি মরিচ গুঁড়ো — স্বাদমতো',
      ],
      steps: [
        'খাসির মাংস ভালো করে ধুয়ে জল ঝরিয়ে নিন। টক দই, আদা-রসুন বাটা, কাঁচা পেঁপে বাটা, হলুদ, মরিচ গুঁড়ো ও ২ টেবিল চামচ সরিষার তেল দিয়ে অন্তত ২ ঘণ্টা ম্যারিনেট করে রাখুন।',
        'ভারী তলার কড়াইতে সরিষার তেল গরম করে তেজপাতা, শুকনো মরিচ ও আস্ত গরম মশলা ফোড়ন দিন।',
        'পেঁয়াজ কুচি দিয়ে সোনালী বাদামী হওয়া পর্যন্ত ধৈর্য ধরে ভাজুন। এরপর সামান্য চিনি দিন রঙ সুন্দর হওয়ার জন্য।',
        'ম্যারিনেট করা মাংস কড়াইতে দিয়ে মাঝারি আঁচে ২৫–৩০ মিনিট ভালো করে কষাতে থাকুন যতক্ষণ না তেল আলাদা হয়।',
        'পরিমাণমতো উষ্ণ গরম জল দিয়ে ঢেকে কম আঁচে ৪০ মিনিট রান্না করুন। শেষে ঘি ও ভাজা গরম মশলা ছড়িয়ে নামিয়ে গরম ভাত বা পোলাওয়ের সাথে পরিবেশন করুন।',
      ],
      stepImages: [
        stepMarinateImg,
        stepTemperImg,
        stepTemperImg,
        stepSimmerImg,
        muttonImg,
      ],
      chefTip: 'মাংস কষানোর সময় কখনোই ঠান্ডা জল দেবেন না—সবসময় ফুটন্ত গরম জল ব্যবহার করলে গ্রেভির রঙ ও স্বাদ অসাধারণ হয়।',
    },
  },
  {
    recipe: {
      id: 'chingri-malai-curry',
      title: 'চিংড়ি মালাই কারি',
      subtitle: 'নারকেলের ঘন দুধ আর ঘি-গরম মশলার সুগন্ধে তৈরি বাংলার সবচেয়ে জনপ্রিয় উৎসবের পদ।',
      imageUrl: chingriImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'নন-ভেজ',
      category: 'মাছের রেসিপি',
      cookTime: '৩০ মিনিট',
      prepTime: '১৫ মিনিট',
      difficulty: 'সহজ',
      servings: '৪ জন',
      rating: 4.8,
      ratingCount: 248,
      isPremium: false,
      isFeatured: true,
      orderIndex: 2,
    },
    content: {
      ingredients: [
        'গলদা বা বাগদা চিংড়ি — ৫০০ গ্রাম (পরিষ্কার করা)',
        'নারকেলের ঘন দুধ — ২ কাপ',
        'পেঁয়াজ বাটা — ৩ টেবিল চামচ',
        'আদা বাটা — ১ চা চামচ',
        'হলুদ ও কাশ্মীরি লাল মরিচ গুঁড়ো — ১ চা চামচ করে',
        'সরিষার তেল — ৩ টেবিল চামচ এবং ঘি — ১ টেবিল চামচ',
        'আস্ত গরম মশলা (এলাচ, দারুচিনি, লবঙ্গ) ও কাঁচা মরিচ — ৪টি',
        'লবণ ও চিনি — স্বাদমতো',
      ],
      steps: [
        'চিংড়ি মাছে সামান্য নুন ও হলুদ মাখিয়ে গরম সরিষার তেলে হালকা করে ১ মিনিট ভেজে তুলে রাখুন। বেশি ভাজলে চিংড়ি শক্ত হয়ে যায়।',
        'একই তেলে আস্ত গরম মশলা ফোড়ন দিয়ে পেঁয়াজ বাটা ও আদা বাটা দিয়ে কষান।',
        'হলুদ, মরিচ গুঁড়ো ও সামান্য জল দিয়ে মশলা কষিয়ে তেল ভেসে উঠলে নারকেলের দুধ ঢেলে দিন।',
        'গ্রেভি ফুটে উঠলে ভাজা চিংড়ি, চেরা কাঁচা মরিচ ও সামান্য চিনি দিয়ে কম আঁচে ৫–৭ মিনিট রান্না করুন।',
        'নামানোর আগে ১ চামচ ঘি ও গরম মশলার গুঁড়ো ছড়িয়ে দিন। বাসমতি ভাত বা বাসন্তী পোলাওয়ের সাথে পরিবেশন করুন।',
      ],
      stepImages: [
        stepMarinateImg,
        stepTemperImg,
        stepSimmerImg,
        stepGarnishImg,
        chingriImg,
      ],
      chefTip: 'নারকেলের দুধ দেওয়ার পর আঁচ একদম কমিয়ে রাখুন, নাহলে দুধ ফেটে যেতে পারে।',
    },
  },
  {
    recipe: {
      id: 'chicken-biryani',
      title: 'চিকেন বিরিয়ানি',
      subtitle: 'জাফরান, কেওড়া জল ও ঘ্রাণযুক্ত মশলায় দমে রান্না করা ঘরোয়া শাহী চিকেন বিরিয়ানি।',
      imageUrl: biryaniImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'নন-ভেজ',
      category: 'ভাত ও পোলাও',
      cookTime: '১ ঘন্টা ২০ মিনিট',
      prepTime: '৪০ মিনিট',
      difficulty: 'মাঝারি',
      servings: '৫ জন',
      rating: 4.8,
      ratingCount: 412,
      isPremium: true,
      isFeatured: true,
      orderIndex: 3,
    },
    content: {
      ingredients: [
        'বাসমতি চাল — ৫০০ গ্রাম (৩০ মিনিট ভেজানো)',
        'চিকেন লেগ ও থাই পিস — ৮০০ গ্রাম',
        'বেরেস্তা (ভাজা পেঁয়াজ) — ১ কাপ',
        'টক দই — ১০০ গ্রাম',
        'বিরিয়ানি মশলা — ২ টেবিল চামচ',
        'জাফরান ভেজানো উষ্ণ দুধ — আধা কাপ',
        'ঘি — ৪ টেবিল চামচ, গোলাপ জল ও কেওড়া জল — ১ চা চামচ করে',
        'আলু (বড় টুকরো, ঐচ্ছিক) — ৪টি',
      ],
      steps: [
        'মুরগির মাংস টক দই, আদা-রসুন বাটা, বিরিয়ানি মশলা, লবণ ও অর্ধেক বেরেস্তা দিয়ে ১ ঘণ্টা ম্যারিনেট করুন।',
        'হাঁড়িতে জল ফুটিয়ে আস্ত গরম মশলা, তেজপাতা ও লবণ দিয়ে চাল ৮০% সেদ্ধ করে জল ঝরিয়ে নিন।',
        'অন্য প্যানে ঘি গরম করে ম্যারিনেট করা চিকেন ২০ মিনিট ভালো করে কষিয়ে সেদ্ধ করে নিন।',
        'ভারী হাঁড়িতে প্রথমে চিকেন, তার ওপর সেদ্ধ চাল, বেরেস্তা, জাফরান দুধ, পুদিনা পাতা, ধনেপাতা ও ঘি স্তরে স্তরে সাজিয়ে দিন।',
        'হাঁড়ির মুখ ঢাকনা দিয়ে আটকে তাওয়ার ওপর হালকা আঁচে ২০ মিনিট দমে রাখুন। পরিবেশনের আগে আলতো করে মিশিয়ে নিন।',
      ],
      stepImages: [
        stepMarinateImg,
        stepTemperImg,
        stepSimmerImg,
        stepGarnishImg,
        biryaniImg,
      ],
      chefTip: 'চাল ৮০%-এর বেশি সেদ্ধ করবেন না, বাকি ২০% দমে থাকা অবস্থায় ভাপে সুন্দর ঝরঝরে হয়ে যাবে।',
    },
  },
  {
    recipe: {
      id: 'alur-dom',
      title: 'নিরামিষ আলুর দম',
      subtitle: 'লুচি বা পরোটার সাথে জমে যাওয়া ভাজা মশলা আর টমেটো-জিরার স্বাদে খাঁটি আলুর দম।',
      imageUrl: alurDomImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'ভেজ',
      category: 'সবজি রেসিপি',
      cookTime: '৩০ মিনিট',
      prepTime: '১৫ মিনিট',
      difficulty: 'সহজ',
      servings: '৪ জন',
      rating: 4.7,
      ratingCount: 194,
      isPremium: false,
      isFeatured: false,
      orderIndex: 4,
    },
    content: {
      ingredients: [
        'ছোট নতুন আলু — ৫০০ গ্রাম (হালকা ভাপানো ও খোসা ছাড়ানো)',
        'টমেটো পিউরি — ১ কাপ',
        'আদা বাটা — ১.৫ টেবিল চামচ',
        'জিরা, ধনে ও কাশ্মীরি মরিচ গুঁড়ো — ১ চা চামচ করে',
        'হিং — এক চিমটি, তেজপাতা — ২টি',
        'কাজু ও চারমগজ বাটা — ২ টেবিল চামচ',
        'সরিষার তেল — ৩ টেবিল চামচ, ভাজা জিরে-ধনে মশলা — ১ চা চামচ',
      ],
      steps: [
        'সেদ্ধ আলুতে কাঁটাচামচ দিয়ে হালকা ছিদ্র করে নুন-হলুদ মাখিয়ে সোনালী করে ভেজে তুলে রাখুন।',
        'তেলে তেজপাতা, শুকনো মরিচ ও হিং ফোড়ন দিন। এরপর আদা বাটা ও টমেটো পিউরি দিয়ে কষান।',
        'সব গুঁড়ো মশলা ও কাজু বাটা দিয়ে তেল ছাড়া পর্যন্ত নাড়ুন।',
        'ভাজা আলু ও গরম জল দিয়ে ঢেকে ১০ মিনিট কম আঁচে রান্না করুন।',
        'নামানোর আগে ভাজা মশলা, কাঁচা মরিচ ও ধনেপাতা কুচি ছড়িয়ে গরম লুচির সাথে পরিবেশন করুন।',
      ],
      stepImages: [
        stepMarinateImg,
        stepTemperImg,
        stepSimmerImg,
        stepGarnishImg,
        alurDomImg,
      ],
      chefTip: 'নিরামিষ আলুর দমে এক চিমটি হিং ও শুকনো খোলায় ভাজা জিরে-মরিচের গুঁড়ো দিলে রেস্তোরাঁর মতো স্বাদ আসে।',
    },
  },
  {
    recipe: {
      id: 'shorshe-ilish',
      title: 'ঐতিহ্যবাহী সরষে ইলিশ',
      subtitle: 'সাদা ও কালো সরিষা বাটা, কাঁচা মরিচ আর খাঁটি সরিষার তেলে রান্না করা ভরা বর্ষার ইলিশ।',
      imageUrl: ilishImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'নন-ভেজ',
      category: 'মাছের রেসিপি',
      cookTime: '২৫ মিনিট',
      prepTime: '১৫ মিনিট',
      difficulty: 'সহজ',
      servings: '৪ জন',
      rating: 4.9,
      ratingCount: 380,
      isPremium: true,
      isFeatured: true,
      orderIndex: 5,
    },
    content: {
      ingredients: [
        'তাজা ইলিশ মাছের পিস — ৬ টুকরো',
        'কালো সরিষা — ২ টেবিল চামচ, সাদা সরিষা — ১ টেবিল চামচ',
        'কালোজিরা — আধা চা চামচ',
        'কাঁচা মরিচ — ৬টি (চেরা ও বাটার জন্য)',
        'হলুদ গুঁড়ো — ১ চা চামচ',
        'খাঁটি সরিষার তেল — ৫ টেবিল চামচ',
        'লবণ — স্বাদমতো',
      ],
      steps: [
        'সরিষা, ২টি কাঁচা মরিচ ও সামান্য লবণ দিয়ে মিহি করে বেটে ছেঁকে নিন যাতে তিতকুটে ভাব না থাকে।',
        'ইলিশ মাছে নুন ও হলুদ মাখিয়ে রাখুন (ভাজার দরকার নেই)।',
        'কড়াইতে সরিষার তেল গরম করে কালোজিরা ও চেরা কাঁচা মরিচ ফোড়ন দিন।',
        'সামান্য জল ও হলুদ দিয়ে ফুটিয়ে সরিষা বাটা ঢেলে দিন এবং সাথে সাথে মাছের টুকরোগুলো বিছিয়ে দিন।',
        'ঢাকনা দিয়ে মাঝারি আঁচে ৮–১০ মিনিট রান্না করুন। শেষে ২ টেবিল চামচ কাঁচা সরিষার তেল ছড়িয়ে নামিয়ে নিন।',
      ],
      stepImages: [
        stepMarinateImg,
        stepMarinateImg,
        stepTemperImg,
        stepSimmerImg,
        ilishImg,
      ],
      chefTip: 'সরিষা বাটার সময় সামান্য লবণ ও ১টি কাঁচা মরিচ দিলে সরিষা কখনোই তিতা হয় না।',
    },
  },
  {
    recipe: {
      id: 'mishti-doi-rasmalai',
      title: 'মাটির হাঁড়ির মিষ্টি দই ও রসমালাই',
      subtitle: 'ঘরেই সহজ উপায়ে ক্যারামেল ঘন দুধে জমানো আসল বগুড়ার স্বাদের মিষ্টি দই।',
      imageUrl: mishtiImg,
      cuisine: 'বাঙ্গালি',
      dietType: 'ভেজ',
      category: 'মিষ্টান্ন',
      cookTime: '৪৫ মিনিট',
      prepTime: '২০ মিনিট',
      difficulty: 'সহজ',
      servings: '৬ জন',
      rating: 4.8,
      ratingCount: 162,
      isPremium: false,
      isFeatured: false,
      orderIndex: 6,
    },
    content: {
      ingredients: [
        'ফুল ক্রিম দুধ — ১.৫ লিটার',
        'চিনি — ১৮০ গ্রাম (অর্ধেক ক্যারামেলের জন্য)',
        'টক দই (বীজ দই, জল ঝরানো) — ৩ টেবিল চামচ',
        'এলাচ গুঁড়ো — আধা চা চামচ',
        'মাটির পাত্র — ১টি (ভালোভাবে ধুয়ে শুকানো)',
      ],
      steps: [
        'দুধ জ্বাল দিয়ে প্রায় অর্ধেক বা ঘন হওয়া পর্যন্ত কম আঁচে ফুটিয়ে নিন।',
        'অন্য প্যানে অর্ধেক চিনি অল্প আঁচে গলিয়ে সোনালী ক্যারামেল তৈরি করে ধীরে ধীরে গরম দুধে মিশিয়ে দিন। বাকি চিনিও যোগ করুন।',
        'দুধ কুসুম গরম (আঙুল সহ্য করতে পারে এমন) অবস্থায় নামিয়ে জল ঝরানো বীজ দই হুইস্ক দিয়ে ভালো করে মিশিয়ে নিন।',
        'মাটির হাঁড়িতে মিশ্রণ ঢেলে ফয়েল বা ঢাকনা দিয়ে ঢেকে তোয়ালে মুড়িয়ে গরম জায়গায় ৭–৮ ঘণ্টা রেখে দিন।',
        'দই জমে গেলে ফ্রিজে ২ ঘণ্টা ঠান্ডা করে পরিবেশন করুন।',
      ],
      stepImages: [
        stepSimmerImg,
        stepTemperImg,
        stepMarinateImg,
        stepGarnishImg,
        mishtiImg,
      ],
      chefTip: 'বীজ দইয়ে সামান্যও জল থাকলে দই ভালো জমবে না—তাই দই মেশানোর আগে ছাঁকনিতে ৩০ মিনিট ঝরিয়ে নিন।',
    },
  },
];

export const SEED_CATEGORIES: Array<Omit<RecipeCategory, 'createdAt' | 'updatedAt'>> = [
  { id: 'cat-rice', name: 'ভাত ও পোলাও', iconKey: 'rice', orderIndex: 1, isActive: true },
  { id: 'cat-meat', name: 'মাংসের রেসিপি', iconKey: 'meat', orderIndex: 2, isActive: true },
  { id: 'cat-fish', name: 'মাছের রেসিপি', iconKey: 'fish', orderIndex: 3, isActive: true },
  { id: 'cat-veg', name: 'সবজি রেসিপি', iconKey: 'veg', orderIndex: 4, isActive: true },
  { id: 'cat-dal', name: 'ডালের রেসিপি', iconKey: 'dal', orderIndex: 5, isActive: true },
  { id: 'cat-snacks', name: 'নাস্তা ও স্ন্যাক্স', iconKey: 'snacks', orderIndex: 6, isActive: true },
  { id: 'cat-dessert', name: 'মিষ্টান্ন', iconKey: 'dessert', orderIndex: 7, isActive: true },
  { id: 'cat-drink', name: 'পানীয়', iconKey: 'drink', orderIndex: 8, isActive: true },
  { id: 'cat-chinese', name: 'চাইনিজ রেসিপি', iconKey: 'chinese', orderIndex: 9, isActive: true },
];

export const SEED_PLANS: Array<Omit<SubscriptionPlan, 'updatedAt'>> = [
  {
    id: 'basic',
    name: 'বেসিক',
    tier: 'basic',
    priceLabel: 'বিনামূল্যে',
    priceAmount: 0,
    durationLabel: '১ মাসের জন্য: বিনামূল্যে',
    durationDays: 30,
    recipeLimit: 10,
    subtitle: '১০টি ফ্রি রেসিপি শিখতে পারবেন',
    features: [
      'মোট ১০টি ফ্রি রেসিপি শেখার সুযোগ',
      'ধাপে ধাপে ছবিসহ সহজ প্রণালী',
      'বিশেষজ্ঞ কিচেন টিপস',
    ],
    accentColor: 'green',
    isActive: true,
    orderIndex: 1,
  },
  {
    id: 'standard',
    name: 'স্ট্যান্ডার্ড',
    tier: 'standard',
    priceLabel: '১০০ টাকা/মাস',
    priceAmount: 100,
    durationLabel: '১ মাসের জন্য: ১০০ টাকা/মাস',
    durationDays: 30,
    recipeLimit: 10,
    subtitle: 'প্রতি রেসিপি ১০ টাকা হিসেবে ১০টি রেসিপি',
    features: [
      '১০টি প্রিমিয়াম ও ফ্রি রেসিপি আনলক',
      'প্রতি রেসিপি মাত্র ১০ টাকা',
      'প্রতি ধাপে ছবিসহ বিস্তারিত গাইড',
      '১ মাসের সম্পূর্ণ মেয়াদ',
    ],
    accentColor: 'gold',
    isActive: true,
    orderIndex: 2,
  },
  {
    id: 'pro',
    name: 'প্রো',
    tier: 'pro',
    priceLabel: '২০০ টাকা/মাস',
    priceAmount: 200,
    durationLabel: '১ মাসের জন্য: ২০০ টাকা/মাস',
    durationDays: 30,
    recipeLimit: 25,
    subtitle: 'বিশেষ অফার: ২৫টি রেসিপি (৫টি বোনাস!)',
    features: [
      '২৫টি প্রিমিয়াম ও ফ্রি রেসিপি আনলক',
      'অফার: মাত্র ৮ টাকা প্রতি রেসিপিতে',
      'প্রতি ধাপে ছবিসহ এক্সক্লুসিভ প্রণালী',
      '১ মাসের সম্পূর্ণ মেয়াদ',
    ],
    accentColor: 'red',
    isActive: true,
    orderIndex: 3,
  },
];

export const SEED_TIPS: Array<Omit<CookingTip, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'tip-spices-fresh',
    title: 'শুকনো মশলা দীর্ঘদিন সতেজ ও সুগন্ধি রাখার উপায়',
    category: 'মশলা সংরক্ষণ',
    summary: 'হলুদ, জিরা ও গরম মশলার ঘ্রাণ মাসের পর মাস অটুট রাখতে কাচের বয়েম ও রোদে শুকানোর সঠিক কৌশল।',
    content:
      'মশলা কখনোই চুলার একদম পাশে রাখবেন না, কারণ তাপ ও বাষ্প মশলার প্রাকৃতিক তেল নষ্ট করে দেয়। সবসময় এয়ারটাইট কাচের জারে রাখুন এবং প্রতি ২ মাসে একবার হালকা শুকনো খোলায় ২ মিনিট নেড়ে ঠান্ডা করে সংরক্ষণ করুন।',
    readTime: '৩ মিনিট পাঠ',
    isPublished: true,
  },
  {
    id: 'tip-meat-tender',
    title: 'মাংস দ্রুত নরম ও রসালো করার ঘরোয়া কৌশল',
    category: 'মাংস রান্না',
    summary: 'কাঁচা পেঁপে, টক দই ও সঠিক তাপমাত্রায় ম্যারিনেশনের সময় মেনে মাংস মুখে মিলিয়ে যাওয়ার মতো নরম করুন।',
    content:
      'খাসি বা গরুর মাংস রান্নার অন্তত ২ ঘণ্টা আগে টক দই ও ১ চা চামচ কাঁচা পেঁপে বাটা মেখে রাখুন। রান্নার শুরুতে খুব কম আঁচে মাংসের নিজস্ব জলে কষিয়ে নিলে ভেতরটা জুসি থাকে।',
    readTime: '৪ মিনিট পাঠ',
    isPublished: true,
  },
  {
    id: 'tip-biryani-rice',
    title: 'পোলাও ও বিরিয়ানির ভাত ঝরঝরে রাখার ৫টি নিয়ম',
    category: 'ভাত ও পোলাও',
    summary: 'চাল ধোয়া থেকে শুরু করে ভেজানোর সময় ও জলের সঠিক মাপ জানলে ভাত কখনোই গলে যাবে না।',
    content:
      'বাসমতি চাল হালকা হাতে ৩ বার ধুয়ে ঠিক ৩০ মিনিট ভিজিয়ে রাখুন। ফুটন্ত জলে ১ চা চামচ লেবুর রস ও ১ চামচ তেল বা ঘি দিলে প্রতিটি দানা আলাদা ও সাদা ধবধবে থাকে।',
    readTime: '৩ মিনিট পাঠ',
    isPublished: true,
  },
  {
    id: 'tip-fish-fry',
    title: 'কড়াইতে লেগে না গিয়ে মচমচে মাছ ভাজার উপায়',
    category: 'মাছ রান্না',
    summary: 'মাছ ভাজার আগে তেল ও কড়াই গরম করার সঠিক তাপমাত্রা বুঝে নিলেই আর মাছ ভেঙে যাবে না।',
    content:
      'কড়াই ভালোভাবে গরম হলে সরিষার তেল দিন এবং তেল থেকে হালকা ধোঁয়া উঠলে এক চিমটি লবণ ছিটিয়ে দিন। মাছে নুন-হলুদ মাখিয়ে ১০ মিনিট রেখে জল মুছে তেলে ছাড়ুন।',
    readTime: '২ মিনিট পাঠ',
    isPublished: true,
  },
];

export const SEED_BLOGS: Array<Omit<BlogPost, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'blog-bengali-spices',
    title: 'বাঙালি হেঁশেলের পাঁচফোড়ন: পাঁচ মশলার আশ্চর্য রসায়ন',
    excerpt: 'মৌরি, মেথি, কালোজিরা, সর্ষে ও রাঁধুনির নিখুঁত অনুপাতে কীভাবে সাধারণ সবজি রান্নাও হয়ে ওঠে অসাধারণ।',
    content:
      'বাঙালি রান্নার প্রাণ হলো ফোড়ন। গরম তেলে যখন পাঁচফোড়ন ফুটে ওঠে, তখন পুরো বাড়ি এক অদ্ভুত সুন্দর ঘ্রাণে ভরে যায়। পাঁচফোড়নের প্রতিটি মশলার নিজস্ব ঔষধি গুণ এবং স্বাদের স্তর রয়েছে। শুক্তো থেকে শুরু করে আলুর তরকারি কিংবা আমের আচার—সবখানেই পাঁচফোড়নের ব্যবহার আমাদের ঐতিহ্যের অংশ।',
    imageUrl: alurDomImg,
    authorName: 'শেফ আনিসা রহমান',
    category: 'খাদ্য ঐতিহ্য',
    readTime: '৫ মিনিট পাঠ',
    isPublished: true,
  },
  {
    id: 'blog-sunday-mutton',
    title: 'রবিবারের দুপুর ও কষা মাংসের চিরন্তন গল্প',
    excerpt: 'বাঙালির ছুটির দিনের সবচেয়ে প্রিয় পদ কষা মাংসের পেছনের ধৈর্য, আঁচ ও মশলার ঐতিহ্যবাহী গল্প।',
    content:
      'রবিবারের সকাল মানেই বাজার থেকে তাজা খাসির মাংস আর দুপুরের ভাতের পাতে ধোঁয়া ওঠা কষা মাংস। ভালো কষা মাংস রান্নার আসল গোপনীয়তা কোনো দামি উপকরণে নয়, বরং ধীর আঁচে দীর্ঘক্ষণ কষানোর ধৈর্যে। পেঁয়াজের ক্যারামেলাইজড মিষ্টি স্বাদ আর সরিষার তেলের ঝাঁঝ মিলে তৈরি হয় সেই অবিস্মরণীয় স্বাদ।',
    imageUrl: muttonImg,
    authorName: 'শেফ তানভীর আহমেদ',
    category: 'রন্ধন গল্প',
    readTime: '৬ মিনিট পাঠ',
    isPublished: true,
  },
  {
    id: 'blog-hilsa-season',
    title: 'বর্ষার ইলিশ: সরষে থেকে ভাপা, রান্নার সেরা দিকনির্দেশনা',
    excerpt: 'তাজা ইলিশ চেনার উপায় এবং মাছের আসল স্বাদ অক্ষুণ্ণ রেখে রান্নার সহজ টিপস।',
    content:
      'ইলিশ মাছের নিজস্ব তেল ও গন্ধ এতটাই সমৃদ্ধ যে এতে খুব বেশি ভারী মশলার প্রয়োজন হয় না। শুধু কালোজিরা, কাঁচা মরিচ, হলুদ ও বাটা সরিষাই ইলিশের রাজকীয় স্বাদ ফুটিয়ে তুলতে যথেষ্ট। ইলিশ রান্নায় কখনোই পেঁয়াজ বা অতিরিক্ত রসুন ব্যবহার করবেন না, তাতে মাছের সূক্ষ্ম ঘ্রাণ ঢাকা পড়ে যায়।',
    imageUrl: ilishImg,
    authorName: 'শেফ মিতালী সেন',
    category: 'মৌসুমী রান্না',
    readTime: '৪ মিনিট পাঠ',
    isPublished: true,
  },
];

export interface RecipeFontOption {
  key: NonNullable<SiteSettings['recipeFontDesktop']>;
  label: string;
  category: 'handwriting' | 'book';
  categoryLabel: string;
  description: string;
}

export const RECIPE_FONT_OPTIONS: RecipeFontOption[] = [
  {
    key: 'bensen',
    label: 'বেনসেন হ্যান্ডরাইটিং',
    category: 'handwriting',
    categoryLabel: 'হাতের লেখার মতো ফন্ট',
    description: 'মিনিমাল ও পরিষ্কার বলপেন-কলমের মতো ডায়েরী হাতের লেখা',
  },
  {
    key: 'atma',
    label: 'আত্মা হ্যান্ডরাইট',
    category: 'handwriting',
    categoryLabel: 'হাতের লেখার মতো ফন্ট',
    description: 'নরম ও ঘরোয়া তুলির ছোঁয়ায় হাতে লেখা ডায়েরী ফন্ট',
  },
  {
    key: 'tiro-italic',
    label: 'তিরো বাংলা (ডায়েরী ইটালিক)',
    category: 'handwriting',
    categoryLabel: 'হাতের লেখার মতো ফন্ট',
    description: 'হালকা বাঁকা ঝরনা কলমের পাণ্ডুলিপি ধাঁচের লেখা',
  },
  {
    key: 'noto-serif',
    label: 'নোটো শেরিফ বাংলা',
    category: 'book',
    categoryLabel: 'নরমাল বইয়ের লেখার মতো ফন্ট',
    description: 'সাহিত্য ও রান্নার বইয়ের মতো স্পষ্ট ও আরামদায়ক ফন্ট',
  },
  {
    key: 'tiro',
    label: 'তিরো বাংলা (ধ্রুপদী বই)',
    category: 'book',
    categoryLabel: 'নরমাল বইয়ের লেখার মতো ফন্ট',
    description: 'ঐতিহ্যবাহী ছাপাখানার বই ও সাময়িকীর মতো পরিপাটি ফন্ট',
  },
  {
    key: 'hind-siliguri',
    label: 'হিন্দ শিলিগুড়ি',
    category: 'book',
    categoryLabel: 'নরমাল বইয়ের লেখার মতো ফন্ট',
    description: 'আধুনিক, সহজপাঠ্য ও পরিষ্কার প্রিন্ট-স্টাইল ফন্ট',
  },
  {
    key: 'noto-sans',
    label: 'নোটো স্যান্স বাংলা',
    category: 'book',
    categoryLabel: 'নরমাল বইয়ের লেখার মতো ফন্ট',
    description: 'সাধারণ ও সব ডিভাইসে অতি-পরিষ্কার বাংলা লেখা',
  },
];

export interface FontSizeOption {
  key: NonNullable<SiteSettings['adminFontSize']>;
  label: string;
  scaleLabel: string;
  description: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  {
    key: 'sm',
    label: 'ছোট',
    scaleLabel: '৯০%',
    description: 'কমপ্যাক্ট ও এক স্ক্রিনে বেশি তথ্য',
  },
  {
    key: 'md',
    label: 'স্বাভাবিক',
    scaleLabel: '১০০%',
    description: 'সব ডিভাইসের জন্য ভারসাম্যপূর্ণ স্ট্যান্ডার্ড সাইজ',
  },
  {
    key: 'lg',
    label: 'বড়',
    scaleLabel: '১১২%',
    description: 'সহজ ও আরামদায়ক পাঠের জন্য বড় লেখা',
  },
  {
    key: 'xl',
    label: 'অতিরিক্ত বড়',
    scaleLabel: '১২৪%',
    description: 'সর্বোচ্চ স্পষ্টতা ও বড় ফন্ট প্রদর্শন',
  },
];

export const SEED_SETTINGS: Omit<SiteSettings, 'updatedAt'> = {
  siteName: 'রান্না শিখুন',
  tagline: 'সহজ ও খাঁটি বাংলা রান্নার বিশ্বস্ত ঠিকানা',
  announcementText: '১ মাসের স্ট্যান্ডার্ড (১০০ টাকা — ১০টি রেসিপি) ও প্রো অফার (২০০ টাকা — ২৫টি রেসিপি) এখন চালু!',
  showAnnouncement: false,
  paymentBkashNumber: '০১৭১১-০০০০০০ (পার্সোনাল)',
  paymentNagadNumber: '০১৭১১-০০০০০০ (পার্সোনাল)',
  paymentInstructions: 'উপরের বিকাশ বা নগদ নম্বরে Send Money করে নিচের ফর্মে আপনার নম্বর ও ট্রানজেকশন আইডি (TxID) জমা দিন। এডমিন যাচাই করে আপনার প্ল্যান সক্রিয় করে দেবেন।',
  recipeFontDesktop: 'bensen',
  recipeFontMobile: 'bensen',
  recipeFontSizeDesktop: 'md',
  recipeFontSizeMobile: 'md',
  adminFontFamily: 'hind-siliguri',
  adminFontSize: 'md',
  seoTitle: 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম',
  seoDescription: 'সম্পূর্ণ বাংলায় রান্না শিখুন — ধাপে ধাপে ছবিসহ দেশি বিদেশী ও চাইনিজ রেসিপি, রান্না শিখার বিশ্বস্ত ঠিকানা।',
  seoKeywords: 'বাংলা রান্না, বাঙালি রেসিপি, ঘরোয়া রান্না, সরষে ইলিশ, মাটন কারি, রন্ধন শিল্প, রান্না শিখুন',
  seoAuthor: 'রান্না শিখুন',
  canonicalBaseUrl: '',
  seoRobotsPolicy: 'index, follow',
  googleSiteVerification: '',
  googleVerificationFile: '',
  bingSiteVerification: '',
  googleAnalyticsId: '',
  robotsTxtExtra: '',
  socialShareImageUrl: '',
  socialShareTitle: 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম',
  socialShareDescription: 'সম্পূর্ণ বাংলায় রান্না শিখুন — ধাপে ধাপে ছবিসহ দেশি বিদেশী ও চাইনিজ রেসিপি, রান্না শিখার বিশ্বস্ত ঠিকানা।',
  socialShareImageAlt: 'রান্না শিখুন — সহজে বাংলায় রান্না শেখার প্ল্যাটফর্ম',
  twitterHandle: '',
  fbAppId: '',
  showRecipeShareButton: true,
  contactEmail: 'rannashikhun@gmail.com',
  contactPhone: '+৮৮০ ১৭১১-০০০০০০',
  contactAddress: 'বাড়ি ২৪, রোড ৭, ধানমন্ডি, ঢাকা-১২০৫',
  footerNote: '© ২০২৬ রান্না শিখুন — সর্বস্বত্ব সংরক্ষিত। সম্পূর্ণ বাংলায় রান্না শেখার প্ল্যাটফর্ম।',
};
