import { I18n } from 'aws-amplify';
import { Translations } from '@aws-amplify/ui-components';

I18n.putVocabulariesForLanguage('tr', {
    [Translations.SIGN_IN_HEADER_TEXT]: 'Hesabına Giriş Yap',
    [Translations.SIGN_IN_ACTION]: 'Giriş Yap',
    [Translations.USERNAME_LABEL]: 'Telefon *',
    [Translations.USERNAME_PLACEHOLDER]: 'Telefon numaranızı giriniz.',
    [Translations.PASSWORD_LABEL]: 'Şifre *',
    [Translations.PASSWORD_PLACEHOLDER]: 'Şifrenizi giriniz. ',
    [Translations.FORGOT_PASSWORD_TEXT]: 'Şifrenizi mi unuttunuz? ',
    [Translations.RESET_PASSWORD_TEXT]: 'Sifremi Sıfırla',
    [Translations.SIGN_OUT]: 'Cıkış Yap',
    [Translations.RESET_YOUR_PASSWORD]: 'Şifre Sıfırla',
    [Translations.BACK_TO_SIGN_IN]: 'Geri dön',
    [Translations.SEND_CODE]: 'Kod Gönder',
    [Translations.CHANGE_PASSWORD]: 'Şifre Değiştir',
    [Translations.NEW_PASSWORD_LABEL]: 'Yeni Şifre',
    [Translations.NEW_PASSWORD_PLACEHOLDER]: 'Yeni şifreni gir',
    [Translations.CHANGE_PASSWORD_ACTION]: 'Değiştir',
    [Translations.VERIFY_CONTACT_HEADER_TEXT]: 'Hesap kurtarmak için doğrulanmış iletişim bilgisi gereklidir.',
    [Translations.VERIFY_CONTACT_VERIFY_LABEL]: 'Doğrula',
    [Translations.PHONE_LABEL]: 'Telefon No *',
});

export default I18n;
