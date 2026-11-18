/* ============================================================
   KHQR / EMVCo dynamic QR builder
   ------------------------------------------------------------
   Builds a standard KHQR payload (Bakong, Cambodia) that any
   Cambodian banking app can scan. Field order follows the
   KHQR Content Guideline:
     00 payload format, 01 dynamic, 29/30 account info,
     52 MCC, 53 currency, 54 amount, 58 country, 59 name,
     60 city, 62 extra data, 63 CRC-16/CCITT-FALSE.
   ============================================================ */
(function (global) {
  'use strict';

  var encoder = new TextEncoder();

  function bytes(str) {
    return encoder.encode(String(str));
  }

  function tlv(tag, value) {
    var text = String(value);
    var len = bytes(text).length;
    if (len > 99) throw new Error('KHQR field ' + tag + ' is too long');
    return tag + (len < 10 ? '0' + len : String(len)) + text;
  }

  function crc16(str) {
    var data = bytes(str);
    var crc = 0xffff;
    for (var i = 0; i < data.length; i++) {
      crc ^= data[i] << 8;
      for (var bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function clampText(value, max, label) {
    var text = String(value || '').trim();
    if (bytes(text).length > max) {
      throw new Error(label + ' must be ' + max + ' characters or fewer');
    }
    return text;
  }

  function additionalData(opts) {
    var parts = '';
    if (opts.billNumber) parts += tlv('01', clampText(opts.billNumber, 25, 'Order ID'));
    if (opts.mobileNumber) parts += tlv('02', clampText(opts.mobileNumber, 25, 'Mobile number'));
    if (opts.storeLabel) parts += tlv('03', clampText(opts.storeLabel, 25, 'Store label'));
    if (opts.terminalLabel) parts += tlv('07', clampText(opts.terminalLabel, 25, 'Terminal label'));
    if (opts.purpose) parts += tlv('08', clampText(opts.purpose, 25, 'Purpose'));
    return parts ? tlv('62', parts) : '';
  }

  function build(opts) {
    if (!opts || typeof opts !== 'object') throw new Error('KHQR options are required');

    var type = opts.type === 'merchant' ? 'merchant' : 'individual';
    var bakongId = String(opts.bakongId || '').trim();
    var merchantName = clampText(opts.merchantName, 25, 'Merchant name');
    var city = clampText(opts.city || 'Phnom Penh', 15, 'Merchant city');
    var amount = Number(opts.amount);
    var currency = opts.currency === 'KHR' ? 'KHR' : 'USD';

    if (!bakongId || bakongId.indexOf('@') < 1 || bakongId.length > 32) {
      throw new Error('Bakong account ID is invalid (example: name@abaa)');
    }
    if (!merchantName) throw new Error('Merchant name is required');
    if (!isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');

    var amountText;
    if (currency === 'KHR') {
      if (amount % 1 !== 0) throw new Error('KHR amounts must be whole numbers');
      amountText = String(Math.round(amount));
    } else {
      amountText = amount.toFixed(2);
    }

    var payload = '';
    payload += tlv('00', '01');
    payload += tlv('01', '12');

    var accountInfo = tlv('00', bakongId);
    if (type === 'merchant') {
      if (!opts.merchantId) throw new Error('Merchant ID is required for merchant QR');
      accountInfo += tlv('01', clampText(opts.merchantId, 32, 'Merchant ID'));
      if (opts.bankName) accountInfo += tlv('02', clampText(opts.bankName, 32, 'Acquiring bank'));
      payload += tlv('30', accountInfo);
    } else {
      if (opts.accountInfo) accountInfo += tlv('01', clampText(opts.accountInfo, 32, 'Account information'));
      if (opts.bankName) accountInfo += tlv('02', clampText(opts.bankName, 32, 'Acquiring bank'));
      payload += tlv('29', accountInfo);
    }

    payload += tlv('52', String(opts.mcc || '5999').slice(0, 4));
    payload += tlv('53', currency === 'KHR' ? '116' : '840');
    payload += tlv('54', amountText);
    payload += tlv('58', 'KH');
    payload += tlv('59', merchantName);
    payload += tlv('60', city);
    payload += additionalData(opts);

    var created = opts.createdAt || Date.now();
    var expires = opts.expiresAt || created + 15 * 60 * 1000;
    payload += tlv('99', tlv('00', String(created)) + tlv('01', String(expires)));

    payload += '6304';
    return payload + crc16(payload);
  }

  global.KHQR = { build: build, crc16: crc16 };
})(window);
