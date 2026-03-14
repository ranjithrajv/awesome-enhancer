declare module 'awesome-lint' {
  interface ReportOptions {
    filename?: string;
    reporter?: (...args: unknown[]) => void;
    config?: unknown[];
  }

  interface AwesomeLint {
    (options?: ReportOptions): Promise<unknown[]>;
    report(options?: ReportOptions): Promise<void>;
  }

  const awesomeLint: AwesomeLint;
  export default awesomeLint;
}
