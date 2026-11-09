/**
 * Resolves 42 Intra Project URLs for 42cursus subjects.
 * Strictly adheres to format: https://projects.intra.42.fr/42cursus-<slug>/mine
 */
export function getIntraProjectUrl(subjectSlug: string): string {
  if (!subjectSlug) {
    return 'https://projects.intra.42.fr';
  }

  // Normalize: lowercased, trimmed, strip leading 42cursus- prefix
  let slug = subjectSlug.toLowerCase().trim().replace(/^42cursus-/, '');

  const aliases: Record<string, string> = {
    'gnl': 'get_next_line',
    'get-next-line': 'get_next_line',
    'printf': 'ft_printf',
    'ft-printf': 'ft_printf',
    'b2br': 'born2beroot',
    'born-2-be-root': 'born2beroot',
    'push-swap': 'push_swap',
    'so-long': 'so_long',
    'fractol': 'fract-ol',
    'fract_ol': 'fract-ol',
    'philo': 'philosophers',
    'transcendence': 'ft_transcendence',
    'ft-transcendence': 'ft_transcendence',
    'irc': 'ft_irc',
    'ft-irc': 'ft_irc',
  };

  if (aliases[slug]) {
    slug = aliases[slug];
  }

  return `https://projects.intra.42.fr/42cursus-${slug}/mine`;
}
