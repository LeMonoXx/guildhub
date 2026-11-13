interface WordmarkProps {
  readonly text: string;
  readonly as?: "p" | "h1";
}

export function Wordmark({ text, as: Tag = "p" }: WordmarkProps) {
  return (
    <Tag className="wordmark" data-text={text}>
      <span className="wordmark-text">{text}</span>
    </Tag>
  );
}
