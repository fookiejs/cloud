const FOOKIE_CLOUD = 'https://fookiecloud.com';

export function FookieCloudMark(props: {
  href?: string;
  size?: 'sm' | 'md';
  className?: string;
}): React.JSX.Element {
  const href = props.href ?? FOOKIE_CLOUD;
  const size = props.size ?? 'md';
  const sizeClass = size === 'sm' ? 'fookie-cloud-mark--sm' : '';
  const classes = ['fookie-cloud-mark', sizeClass, props.className]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ');
  return (
    <a href={href} className={classes}>
      Fookie<span className="fookie-cloud-word">Cloud</span>
    </a>
  );
}

export { FOOKIE_CLOUD };
