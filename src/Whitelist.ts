/**
 * A whitelist containing globals, properties and events for
 * which any compatibility issues must not be reported.
 */
class Whitelist {

    private m_global: Set<string> = new Set<string>();
    private m_properties: Map<string, Set<string>> = new Map<string, Set<string>>();
    private m_events: Map<string, Set<string>> = new Map<string, Set<string>>();

    /**
     * Adds a global type/variable/function to the whitelist.
     * @param name The name of the global to add.
     */
    public addGlobal(name: string): void {
        this.m_global.add(name);
    }

    /**
     * Adds a property of a type to the whitelist.
     * @param typeName The name of the type.
     * @param propName The name of a property on the type represented
     *                 by typeName, or "*" to whitelist all properties
     *                 of the type.
     */
    public addProperty(typeName: string, propName: string): void {
        let typeWhitelist = this.m_properties.get(typeName);
        if (typeWhitelist === undefined) {
            typeWhitelist = new Set<string>();
            this.m_properties.set(typeName, typeWhitelist);
        }
        typeWhitelist.add(propName);
    }

    /**
     * Adds an event of a type to the whitelist.
     * @param typeName The name of the type.
     * @param propName The name of an event on the type represented
     *                 by typeName, or "*" to whitelist all events
     *                 of the type.
     */
    public addEvent(typeName: string, eventName: string): void {
        let typeWhitelist = this.m_events.get(typeName);
        if (typeWhitelist === undefined) {
            typeWhitelist = new Set<string>();
            this.m_events.set(typeName, typeWhitelist);
        }
        typeWhitelist.add(eventName);
    }

    /**
     * Checks if a global type/variable/function is whitelisted.
     * @returns True if whitelisted, false otherwise.
     * @param name The name of the global to check.
     */
    public isGlobalWhitelisted(name: string): boolean {
        return this.m_global.has(name);
    }

    /**
     * Checks if a property or event of a type is whitelisted.
     * @returns True if whitelisted, false otherwise.
     * @param typeName The name of the type.
     * @param propName The name of the property or event on the type represented
     *                 by typeName to check.
     * @param isEvent  True if propName is the name of an event, otherwise false.
     */
    public isPropertyOrEventWhitelisted(typeName: string, propName: string, isEvent: boolean): boolean {
        const whitelist = isEvent ? this.m_events : this.m_properties;
        const typeWhitelist = whitelist.get(typeName);
        return typeWhitelist !== undefined
            && (typeWhitelist.has(propName) || typeWhitelist.has("*"));
    }

}

export default Whitelist;
