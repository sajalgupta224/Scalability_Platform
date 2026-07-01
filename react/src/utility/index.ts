export const formatBotMessage = (text: string): string => {
    return text
      // Replace \n\n with paragraph breaks
      // .split('\n\n')
      // .map(paragraph => {
      //   // Check if it's a numbered list item
      //   if (/^\d+\.\s/.test(paragraph)) {
      //     return paragraph;
      //   }
      //   return `<p>${paragraph}</p>`;
      // })
      // .join('')
      // // Convert numbered lists
      // .replace(/(\d+\.\s\*\*[^*]+\*\*:[^\n]+(\n|$))+/g, (match) => {
      //   const items = match
      //     .trim()
      //     .split(/(?=\d+\.\s)/)
      //     .filter(item => item.trim())
      //     .map(item => {
      //       // Extract number, bold text, and description
      //       const formatted = item
      //         .replace(/^\d+\.\s\*\*([^*]+)\*\*:\s*(.+)/, '<li><strong>$1</strong>: $2</li>');
      //       return formatted;
      //     })
      //     .join('');
      //   return `<ol>${items}</ol>`;
      // })
      // // Convert remaining **text** to <strong>text</strong>
      // .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // // Clean up any remaining \n
      // .replace(/\n/g, ' ');
  };