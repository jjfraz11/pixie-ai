import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
const window = new JSDOM('').window;
const purify = DOMPurify(window);
export function sanitizeData() {
    return async (context) => {
        const { data } = context;
        if (data) {
            // Recursively sanitize all string values in data
            const deepSanitize = (obj) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        // Apply XSS protection using DOMPurify
                        obj[key] = purify.sanitize(obj[key]);
                        // Apply general string sanitization (e.g., trim, escape HTML entities)
                        obj[key] = validator.trim(obj[key]);
                        obj[key] = validator.escape(obj[key]);
                    }
                    else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        deepSanitize(obj[key]);
                    }
                }
            };
            deepSanitize(data);
        }
        return context;
    };
}
