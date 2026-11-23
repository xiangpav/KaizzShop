/* ============================================================
   KaizzShop — shop settings
   ------------------------------------------------------------
   1. Replace merchant.bakongId with YOUR Bakong account ID
      (the name shown in your banking app, e.g. sophea@abaa).
   2. Set merchant.placeholder to false.
   3. Update the Telegram handle and link below.
   Every dynamic KHQR is generated from these values.
   ============================================================ */

window.KAIZZ_CONFIG = {
  shopName: 'KaizzShop',

  telegramHandle: 'Kaizz',
  telegramUrl: 'https://t.me/Isme_kaizz',

  supportHours: '8:00 – 23:00 (GMT+7), daily',
  supportPhone: '',

  paymentWindowMinutes: 15,
  orderHistoryLimit: 30,

  merchant: {
    // 'individual' uses KHQR tag 29 (Bakong account only).
    // 'merchant'   uses KHQR tag 30 (merchant ID + acquiring bank).
    type: 'individual',

    // KaizzShop's ABA account, decoded from the official ABA KHQR image.
    // KHR 018 047 828 / USD 018 047 827 — both resolve through this Bakong ID.
    bakongId: 'abaakhppxxx@abaa',
    merchantId: '',
    bankName: 'ABA Bank',

    merchantName: 'KaizzShop',
    city: 'Phnom Penh',
    currency: 'USD',
    mcc: '5999',

    placeholder: false
  }
};
