type DebouncedFunction<T extends (...args: any[]) => any> = (
    ...args: Parameters<T>
) => ReturnType<T>;

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 100
): DebouncedFunction<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        // eslint-disable-next-line no-invalid-this, @typescript-eslint/no-this-alias
        const context = this;

        return new Promise<ReturnType<T>>((resolve) => {
            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => {
                timeout = null;
                resolve(func.apply(context, args));
            }, wait);
        });
    } as DebouncedFunction<T>;
}