import { ELanguage } from '../../domain/common/language';
import { languageFrom } from '../../interfaces/http/middlewares/language.middleware';

describe('When we read the language of a request', () => {
  it('should pick Portuguese for any pt tag', () => {
    expect(languageFrom('pt-BR')).toBe(ELanguage.PT_BR);
    expect(languageFrom('pt')).toBe(ELanguage.PT_BR);
    expect(languageFrom('PT-br,en;q=0.8')).toBe(ELanguage.PT_BR);
  });

  it('should fall back to English otherwise', () => {
    expect(languageFrom(undefined)).toBe(ELanguage.EN);
    expect(languageFrom('')).toBe(ELanguage.EN);
    expect(languageFrom('es-ES,pt;q=0.5')).toBe(ELanguage.EN);
    expect(languageFrom('en-US')).toBe(ELanguage.EN);
  });
});
