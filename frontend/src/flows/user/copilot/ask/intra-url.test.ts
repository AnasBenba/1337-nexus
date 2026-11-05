import { describe, it, expect } from 'vitest';
import { getIntraProjectUrl } from './intra-url';

describe('getIntraProjectUrl', () => {
  it('formats libft project URL correctly with /mine', () => {
    expect(getIntraProjectUrl('libft')).toBe(
      'https://projects.intra.42.fr/42cursus-libft/mine'
    );
  });

  it('formats GNL alias to get_next_line with /mine', () => {
    expect(getIntraProjectUrl('gnl')).toBe(
      'https://projects.intra.42.fr/42cursus-get_next_line/mine'
    );
    expect(getIntraProjectUrl('GNL')).toBe(
      'https://projects.intra.42.fr/42cursus-get_next_line/mine'
    );
    expect(getIntraProjectUrl('get_next_line')).toBe(
      'https://projects.intra.42.fr/42cursus-get_next_line/mine'
    );
  });

  it('strips redundant 42cursus- prefix if already present', () => {
    expect(getIntraProjectUrl('42cursus-libft')).toBe(
      'https://projects.intra.42.fr/42cursus-libft/mine'
    );
    expect(getIntraProjectUrl('42cursus-get_next_line')).toBe(
      'https://projects.intra.42.fr/42cursus-get_next_line/mine'
    );
  });

  it('resolves common 42cursus aliases', () => {
    expect(getIntraProjectUrl('printf')).toBe(
      'https://projects.intra.42.fr/42cursus-ft_printf/mine'
    );
    expect(getIntraProjectUrl('minishell')).toBe(
      'https://projects.intra.42.fr/42cursus-minishell/mine'
    );
    expect(getIntraProjectUrl('philo')).toBe(
      'https://projects.intra.42.fr/42cursus-philosophers/mine'
    );
  });
});
