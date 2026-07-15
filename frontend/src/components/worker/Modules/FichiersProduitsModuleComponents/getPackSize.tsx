const getPackSize = (pStr: string | number | undefined) => {
    if (!pStr) return 1;
    const match = String(pStr).match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  