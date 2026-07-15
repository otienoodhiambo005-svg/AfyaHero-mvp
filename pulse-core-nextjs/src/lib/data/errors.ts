export class DataSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataSourceUnavailableError';
  }
}

