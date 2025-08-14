export const logger = {
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(...args);
    }
  },
};
