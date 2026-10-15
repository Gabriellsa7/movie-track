import { normalizeText } from '../../domain/common/text.normalizer';

describe('When we normalize a text', () => {
  it('should remove accents and lowercase it', () => {
    expect(normalizeText('Ficção Científica')).toBe('ficcao cientifica');
  });

  it('should trim and collapse inner whitespace', () => {
    expect(normalizeText('  Edward    Newgate  ')).toBe('edward newgate');
  });

  it('should return an empty string for blank input', () => {
    expect(normalizeText('   ')).toBe('');
  });
});
