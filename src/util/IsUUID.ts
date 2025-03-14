
export function isUUID(value: string): boolean {
    // Check if the value is a string and has the correct length
    if (typeof value !== 'string' || value.length !== 36) {
        return false;
    }

    // UUID v4 pattern
    // Format: 8 chars - 4 chars - 4 chars - 4 chars - 12 chars
    // Example: 123e4567-e89b-12d3-a456-426614174000
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidPattern.test(value);
}