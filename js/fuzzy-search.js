function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0, score = 0, run = 0, firstMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (q[qi] === t[ti]) {
      if (firstMatch === -1) firstMatch = ti;
      run++;
      score += run * 2;
      qi++;
    } else {
      run = 0;
    }
  }
  if (qi < q.length) return -Infinity;
  return score - firstMatch;
}

function fuzzyHighlight(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0, out = '';
  for (let ti = 0; ti < text.length; ti++) {
    if (qi < q.length && t[ti] === q[qi]) {
      out += `<mark>${text[ti]}</mark>`;
      qi++;
    } else {
      out += text[ti];
    }
  }
  return out;
}
