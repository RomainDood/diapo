import { dateLong, money, number } from '@craft-ts/i18n';

export const orderCount = number('count');
export const orderAmount = money('amount', undefined, { currency: 'EUR', minimumFractionDigits: 2 });
export const orderDate = dateLong('date');
