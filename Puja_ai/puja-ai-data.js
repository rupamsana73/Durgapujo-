// Puja AI - Static knowledge and quick actions
// This file contains only Puja-related guidance.
// Actual pandal/metro records will continue to come from the existing canonical app data.

export const PUJA_AI_DATA = {
    welcome: {
        bn: "নমস্কার! 🪔 আমি আপনার পুজো সহায়ক।\nকলকাতার দুর্গাপুজো, প্যান্ডেল, মেট্রো, গন্তব্য ও পুজো প্ল্যান নিয়ে আমাকে জিজ্ঞেস করুন।",
        en: "Namaskar! 🪔 I am your Puja Assistant.\nAsk me about Kolkata Durga Puja, pandals, metro, destinations and Puja planning."
    },

    quickActions: [
        {
            id: "puja-guide",
            icon: "🪔",
            label: "পুজোর গাইড",
            prompt: "কলকাতার দুর্গাপুজোর একটি সুন্দর গাইড দাও।"
        },
        {
            id: "find-pandal",
            icon: "🎪",
            label: "প্যান্ডেল খুঁজুন",
            prompt: "আমার জন্য একটি প্যান্ডেল খুঁজে দাও।"
        },
        {
            id: "find-metro",
            icon: "🚇",
            label: "মেট্রো খুঁজুন",
            prompt: "কাছাকাছি মেট্রো স্টেশন খুঁজতে সাহায্য করো।"
        },
        {
            id: "go-somewhere",
            icon: "📍",
            label: "কোথায় যাব?",
            prompt: "আমি একটি জায়গায় যেতে চাই।"
        },
        {
            id: "puja-plan",
            icon: "🗺️",
            label: "পুজো প্ল্যান",
            prompt: "আমার পুজো প্ল্যান দেখতে বা তৈরি করতে চাই।"
        },
        {
            id: "popular-pandals",
            icon: "⭐",
            label: "জনপ্রিয় প্যান্ডেল",
            prompt: "জনপ্রিয় প্যান্ডেল দেখাও।"
        }
    ],

    guide: {
        title: "কলকাতা দুর্গাপুজো গাইড",

        sections: [
            {
                id: "planning",
                title: "🗓️ পুজোর প্ল্যান কীভাবে করবেন?",
                content:
                    "একদিনে অনেক প্যান্ডেল দেখার চেষ্টা না করে একটি নির্দিষ্ট এলাকার প্যান্ডেল বেছে নিন। কাছাকাছি মেট্রো স্টেশন দেখে রুট তৈরি করলে সময় ও পরিশ্রম দুটোই বাঁচবে। Pujo Planner-এর Planner সেকশনে গিয়ে দিনভিত্তিক তালিকা তৈরি করুন।"
            },

            {
                id: "metro",
                title: "🚇 মেট্রো ব্যবহার করুন",
                content:
                    "কলকাতার পুজো পরিক্রমায় মেট্রো সবচেয়ে আরামদায়ক ও দ্রুততম মাধ্যম। ব্লু লাইন (দক্ষিণেশ্বর থেকে কবি সুভাষ) উত্তর, মধ্য ও দক্ষিণ কলকাতার প্রধান পুজো অঞ্চলগুলিকে সংযুক্ত করে। স্মার্টকার্ড ব্যবহার করলে দীর্ঘ লাইনে দাঁড়াতে হবে না।"
            },

            {
                id: "crowd",
                title: "👥 ভিড় ব্যবস্থাপনা (Crowd Management)",
                content:
                    "জনপ্রিয় প্যান্ডেলগুলিতে বিকেল ৫টা থেকে রাত ১২টা পর্যন্ত ভিড় চরমে থাকে। ভিড় এড়াতে দুপুর ২টা থেকে ৫টার মধ্যে অথবা গভীর রাতে বের হোন। শিশু ও বয়স্কদের সাথে থাকলে ফাঁকা সময় বেছে নিন।"
            },

            {
                id: "safety",
                title: "🛡️ নিরাপত্তা ও সতর্কতা",
                content:
                    "ভিড়ের মধ্যে মোবাইল ফোন, মানিব্যাগ ও মূল্যবান জিনিসপত্র সাবধানে রাখুন। সর্বদা জরুরি হেল্পলাইন নম্বর সঙ্গে রাখুন (কলকাতা পুলিশ: ১০০, হেল্পলাইন: ১০৯০)। বাচ্চাদের পকেটে অভিভাবকের ফোন নম্বর লিখে রাখা ভালো।"
            },

            {
                id: "family-planning",
                title: "👨‍👩‍👧‍👦 পরিবার ও শিশুদের নিয়ে পুজো",
                content:
                    "পরিবার নিয়ে পুজো দেখতে বের হলে পর্যাপ্ত পানীয় জল ও ওষুধ সঙ্গে রাখুন। আরামদায়ক জুতো পরুন। ভিড় কম থাকে এমন চওড়া রাস্তার প্যান্ডেল বেছে নিন এবং একটানা হাঁটার বদলে মাঝে বিশ্রাম নিন।"
            },

            {
                id: "night-hopping",
                title: "🌙 রাতের প্যান্ডেল হপিং (Night Pandal Hopping)",
                content:
                    "রাতের কলকাতার আলোর রোশনাই দেখার মতো। রাত ১২টার পর ভিড় কিছুটা কমে যায়। গভীর রাতে বের হলে আগে থেকে পরিবহন ও ফেরার ব্যবস্থা নিশ্চিত করুন। প্রধান রাস্তায় পুলিশ বুথ ও সহায়তা কেন্দ্র সক্রিয় থাকে।"
            },

            {
                id: "maps",
                title: "🧭 Google Maps ও নেভিগেশন",
                content:
                    "অচেনা প্যান্ডেল বা মেট্রো স্টেশনে পৌঁছাতে Google Maps Directions সবচেয়ে সুবিধাজনক। নিজের বর্তমান লোকেশন অন রাখলে সরাসরি হাঁটার বা ট্রানজিটের পথ দেখতে পাবেন।"
            },

            {
                id: "mahalaya",
                title: "🌅 মহালয়া",
                content:
                    "মহালয়ার মাধ্যমে দেবীপক্ষের শুভ সূচনা হয়। ভোরবেলার মহিষাসুরমর্দিনী পাঠ ও গঙ্গাতীরে পিতৃপুরুষের তর্পণ বাঙালির দুর্গাপূজার আবেগঘন ঐতিহ্য।"
            },

            {
                id: "shasthi",
                title: "🪔 ষষ্ঠী — দেবীর বোধন",
                content:
                    "মহাষষ্ঠীতে দেবীর বোধন, আমন্ত্রণ ও অধিবাস অনুষ্ঠিত হয়। এই দিন থেকেই শহরজুড়ে প্যান্ডেল পরিক্রমা ও উৎসবের আমেজ পুরোদমে শুরু হয়ে যায়।"
            },

            {
                id: "saptami",
                title: "🌿 মহাসপ্তমী — নবপত্রিকা প্রবেশ",
                content:
                    "মহাসপ্তমীতে সকালে নবপত্রিকা বা কলাবউ স্নান করিয়ে দেবীর পাশে স্থাপন করা হয় এবং মহাসপ্তমীর বিশেষ বিহিত পূজা শুরু হয়।"
            },

            {
                id: "ashtami",
                title: "🙏 মহাষ্টমী — অঞ্জলি ও সন্ধিপূজা",
                content:
                    "মহাষ্টমী দুর্গাপূজার সবচেয়ে পবিত্র দিন। সকালের পুষ্পাঞ্জলি, বিভিন্ন স্থানে কুমারী পূজা এবং অষ্টমী-নবমীর সন্ধিক্ষণে ১০৮টি পদ্ম ও প্রদীপ সহযোগে সন্ধিপূজা অত্যন্ত তাৎপর্যপূর্ণ।"
            },

            {
                id: "navami",
                title: "✨ মহানবমী — হোম ও উৎসবের আনন্দ",
                content:
                    "মহানবমীতে বিশেষ হোম ও ভোগ নিবেদন হয়। উৎসবের শেষ পূর্ণ দিন হওয়ায় মানুষ সারারাত জেগে প্যান্ডেল হপিং ও খাওয়া-দাওয়া উপভোগ করেন।"
            },

            {
                id: "dashami",
                title: "🌺 বিজয়া দশমী",
                content:
                    "বিজয়া দশমীতে দেবীর দর্পণ বিসর্জন ও অপরাজিতা পূজা হয়। বিদায়লগ্নে মা দুর্গার চরণে সিঁদুর দিয়ে শুরু হয় সিঁদুর খেলা। সন্ধ্যায় শুরু হয় বিজয়ার কোলাকুলি, প্রণাম ও মিষ্টিমুখ।"
            },

            {
                id: "sindoor-khela",
                title: "🔴 সিঁদুর খেলা",
                content:
                    "দশমীর সকালে বিবাহিত নারীরা দেবীকে মিষ্টি ও পানের সাথে সিঁদুর পরিয়ে একে অপরকে সিঁদুর মাখিয়ে শুভেচ্ছা জানান। এটি সৌহার্দ্য ও উৎসবের অন্যতম বর্ণময় মুহূর্ত।"
            },

            {
                id: "bijoya",
                title: "🤝 শুভ বিজয়া",
                content:
                    "প্রতিমা বিসর্জনের পর শুরু হয় বিজয়ার শুভেচ্ছা বিনিময়। ছোটরা বড়দের প্রণাম করে আশীর্বাদ নেয়, সমবয়সীরা কোলাকুলি করে এবং মিষ্টিমুখে সম্প্রীতির বার্তা ছড়িয়ে পড়ে।"
            },

            {
                id: "pandal-hopping",
                title: "🎪 প্যান্ডেল হপিং কৌশল",
                content:
                    "প্যান্ডেল হপিংয়ের সময় অঞ্চলভিত্তিক ক্লাস্টার করুন — যেমন উত্তর কলকাতা (বাগবাজার, কুমারটুলি, শ্যামবাজার), মধ্য কলকাতা (কলেজ স্কয়ার, সন্তোষ মিত্র স্কয়ার), বা দক্ষিণ কলকাতা (দেশপ্রিয় পার্ক, একডালিয়া, মুদিয়ালি)। মেট্রো ব্যবহার করে দ্রুত এক এলাকা থেকে অন্য এলাকায় যান।"
            }
        ]
    },

    destinations: [
        {
            keywords: ["dum dum", "dumdum", "দমদম"],
            name: "Dum Dum",
            nameBn: "দমদম",
            type: "Metro / Destination",
            googleMapsQuery: "Dum Dum Metro Station Kolkata",
            lat: 22.6046,
            lng: 88.3935,
            nearestMetro: "dumdum",
            keyword: "dum dum"
        },

        {
            keywords: ["dakshineswar", "দক্ষিণেশ্বর"],
            name: "Dakshineswar",
            nameBn: "দক্ষিণেশ্বর",
            type: "Metro / Destination",
            googleMapsQuery: "Dakshineswar Metro Station Kolkata",
            lat: 22.6547,
            lng: 88.3569,
            nearestMetro: "dakshineswar",
            keyword: "dakshineswar"
        },

        {
            keywords: ["deshapriya", "deshapriya park", "দেশপ্রিয় পার্ক", "দেশপ্রিয়", "দেশপ্রিয়"],
            name: "Deshapriya Park",
            nameBn: "দেশপ্রিয় পার্ক",
            type: "Pandal Area",
            googleMapsQuery: "Deshapriya Park Durgotsav Kolkata",
            lat: 22.5186,
            lng: 88.3582,
            nearestMetro: "kalighat",
            keyword: "deshapriya"
        },

        {
            keywords: ["kalighat", "কালীঘাট", "কালিঘাট"],
            name: "Kalighat",
            nameBn: "কালীঘাট",
            type: "Metro / Pandal Area",
            googleMapsQuery: "Kalighat Metro Station Kolkata",
            lat: 22.5200,
            lng: 88.3450,
            nearestMetro: "kalighat",
            keyword: "kalighat"
        },

        {
            keywords: ["baghbazar", "বাগবাজার"],
            name: "Baghbazar",
            nameBn: "বাগবাজার",
            type: "Pandal Area",
            googleMapsQuery: "Baghbazar Sarbojanin Durgotsav Kolkata",
            lat: 22.6010,
            lng: 88.3680,
            nearestMetro: "shyambazar",
            keyword: "baghbazar"
        },

        {
            keywords: ["kumartuli", "কুমারটুলি", "কুমারটুলী"],
            name: "Kumartuli",
            nameBn: "কুমারটুলি",
            type: "Pandal Area",
            googleMapsQuery: "Kumartuli Park Sarbojanin Durgotsav Kolkata",
            lat: 22.5980,
            lng: 88.3640,
            nearestMetro: "shobhabazar",
            keyword: "kumartuli"
        },

        {
            keywords: ["college square", "কলেজ স্কয়ার", "কলেজ স্কোয়ার"],
            name: "College Square",
            nameBn: "কলেজ স্কয়ার",
            type: "Pandal Area",
            googleMapsQuery: "College Square Sarbojanin Durgotsav Kolkata",
            lat: 22.5762,
            lng: 88.3644,
            nearestMetro: "central",
            keyword: "college"
        },

        {
            keywords: ["shyambazar", "শ্যামবাজার"],
            name: "Shyambazar",
            nameBn: "শ্যামবাজার",
            type: "Metro / Destination",
            googleMapsQuery: "Shyambazar Five Point Crossing Kolkata",
            lat: 22.6012,
            lng: 88.3745,
            nearestMetro: "shyambazar",
            keyword: "shyambazar"
        },

        {
            keywords: ["ekdalia", "ekdalia evergreen", "একডালিয়া", "একডালিয়া"],
            name: "Ekdalia Evergreen",
            nameBn: "একডালিয়া এভারগ্রীন",
            type: "Pandal Area",
            googleMapsQuery: "Ekdalia Evergreen Club Kolkata",
            lat: 22.5180,
            lng: 88.3670,
            nearestMetro: "kalighat",
            keyword: "ekdalia"
        },

        {
            keywords: ["chetla", "chetla agrani", "চেতলা", "চেতলা অগ্রণী"],
            name: "Chetla Agrani",
            nameBn: "চেতলা অগ্রণী",
            type: "Pandal Area",
            googleMapsQuery: "Chetla Agrani Club Kolkata",
            lat: 22.5160,
            lng: 88.3410,
            nearestMetro: "kalighat",
            keyword: "chetla"
        },

        {
            keywords: ["howrah", "howrah station", "হাওড়া", "হাওড়া"],
            name: "Howrah",
            nameBn: "হাওড়া",
            type: "Metro / Railway Hub",
            googleMapsQuery: "Howrah Metro Station Kolkata",
            lat: 22.5842,
            lng: 88.3420,
            nearestMetro: "howrah",
            keyword: "howrah"
        },

        {
            keywords: ["sector v", "sector 5", "salt lake sector v", "সেক্টর ৫", "সেক্টর ফাইভ", "সল্টলেক"],
            name: "Sector V",
            nameBn: "সেক্টর ৫",
            type: "Metro / IT Hub",
            googleMapsQuery: "Sector V Metro Station Kolkata",
            lat: 22.5718,
            lng: 88.4310,
            nearestMetro: "sectorv",
            keyword: "salt lake"
        },

        {
            keywords: ["santosh mitra", "santosh mitra square", "lebutala", "সন্তোষ মিত্র", "সন্তোষ মিত্র স্কয়ার"],
            name: "Santosh Mitra Square",
            nameBn: "সন্তোষ মিত্র স্কয়ার",
            type: "Pandal Area",
            googleMapsQuery: "Santosh Mitra Square Durga Puja Kolkata",
            lat: 22.5680,
            lng: 88.3670,
            nearestMetro: "sealdah",
            keyword: "santosh"
        },

        {
            keywords: ["maddox", "maddox square", "ম্যাডক্স", "ম্যাডক্স স্কয়ার"],
            name: "Maddox Square",
            nameBn: "ম্যাডক্স স্কয়ার",
            type: "Pandal Area",
            googleMapsQuery: "Maddox Square Durga Puja Kolkata",
            lat: 22.5280,
            lng: 88.3610,
            nearestMetro: "netajibhawan",
            keyword: "maddox"
        },

        {
            keywords: ["suruchi", "suruchi sangha", "new alipore", "সুরুচি", "সুরুচি সংঘ"],
            name: "Suruchi Sangha",
            nameBn: "সুরুচি সংঘ",
            type: "Pandal Area",
            googleMapsQuery: "Suruchi Sangha Durga Puja Kolkata",
            lat: 22.5110,
            lng: 88.3320,
            nearestMetro: "kalighat",
            keyword: "suruchi"
        },

        {
            keywords: ["sealdah", "sealdah station", "শিয়ালদহ", "শিয়ালদা", "শিয়ালদহ", "শিয়ালদা"],
            name: "Sealdah",
            nameBn: "শিয়ালদহ",
            type: "Metro / Railway Hub",
            googleMapsQuery: "Sealdah Metro Station Kolkata",
            lat: 22.5695,
            lng: 88.3705,
            nearestMetro: "sealdah",
            keyword: "sealdah"
        }
    ],

    suggestions: [
        "দমদম যেতে চাই",
        "দমদমের কাছে প্যান্ডেল দেখাও",
        "বাগবাজারের প্যান্ডেল দেখাও",
        "দেশপ্রিয় পার্কের পথ দেখাও",
        "জনপ্রিয় প্যান্ডেল কোনগুলো?",
        "কাছের মেট্রো স্টেশন দেখাও",
        "অষ্টমী অঞ্জলির সময় ও তথ্য",
        "একদিনের পুজো প্ল্যান কীভাবে করব?"
    ]
};