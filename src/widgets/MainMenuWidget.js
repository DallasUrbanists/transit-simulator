import { $, $$, displayNone, displayShow } from "../misc/utilities.mjs";
import { processRoutesFromSource } from "../models/routes";
import { agencies } from "../models/sources";
import UserPreferences from "../UserPreferences";

const create = (tagName, className, attributes = {}) => {
    const elem = document.createElement(tagName);
    elem.className = className;
    for (let attr in attributes) {
        elem.setAttribute(attr, attributes[attr]);
    }
    return elem;
};

export default class MainMenuWidget {
    constructor(elementId, preferences) {
        this.element = $('#'+elementId);
        this.preferences = preferences;
        this.agencyContainer = this.element.querySelector('.select-agencies');
        this.routesContainer = this.element.querySelector('.select-routes');
        this.serviceIDsContainer = this.element.querySelector('.select-service-ids');

        console.log(preferences);

        agencies.forEach((agency, agencyId) => {
            const div = create('div', 'agency-option');
            const id = 'agency-checkbox-' + agencyId;
            const checkbox = create('input', 'agency-option-checkbox', {
                id,
                type: 'checkbox',
                name: 'agency-selection',
                value: agencyId,
            });
            if (this.preferences.enableAgencies.has(agencyId)) {
                checkbox.checked = true;
                this.updateRouteOptions(agencyId);
            }
            checkbox.onclick = () => {
                this.updateAgencyPreferences();
                this.updateRouteOptions(agencyId);
            };
            const label = create('label', 'agency-option-label', { for: id });
            label.innerText = agency.name;
            div.appendChild(checkbox);
            div.appendChild(label);
            this.agencyContainer.appendChild(div);
        });
    }
    updateAgencyPreferences() {
        this.preferences.enableAgencies.clear();
        this.agencyContainer.querySelectorAll('.agency-option-checkbox').forEach(checkbox => {
            if (checkbox.checked) {
                this.preferences.enableAgencies.add(checkbox.value);
            }
        });
    }
    updateRouteOptions(agencyId) {
        const agency = agencies.get(agencyId);
        const divId = 'agency-routes-' + agency.folder;
        console.log(divId);
        const toggleId = 'select-all-routes-' + agencyId;
        let div = $('#'+divId);
        if (this.preferences.enableAgencies.has(agencyId)) {
            if (!div) {
                div = create('div', 'agency-route-options', { id: divId });
                const h2 = create('h2');
                h2.innerText = agency.name + ' Routes';
                div.appendChild(h2);
                const toggle = create('button', 'select-all-routes', { id: toggleId });
                toggle.innerText = 'Toggle all routes';
                toggle.onclick = () => this.toggleAllRoutes(agencyId);
                div.appendChild(toggle);
                this.routesContainer.appendChild(div);
                processRoutesFromSource(agency.folder).then(routes => routes.forEach((route, routeId) => {
                    const routeDiv = create('div', 'route-option');
                    const routeBoxId = 'agency-checkbox-' + routeId;
                    const checkbox = create('input', 'route-option-checkbox', {
                        id: routeBoxId,
                        type: 'checkbox',
                        name: 'route-selection',
                        value: routeId
                    });
                    checkbox.dataset.agency = agencyId;
                    if (this.preferences.enableRoutes === UserPreferences.ALL_AVAILABLE || this.preferences.enableRoutes.has(routeId)) {
                        checkbox.checked = true;
                    }
                    checkbox.onclick = (e) => {
                        this.updateRouteSelections();
                    };
                    const label = create('label', 'route-option-label', { for: routeBoxId });
                    label.innerText = (route.get('route_short_name') + ' ' + route.get('route_long_name')).trim();
                    routeDiv.appendChild(checkbox);
                    routeDiv.appendChild(label);
                    div.appendChild(routeDiv);
                }));
            }
            displayShow(div);
        } else if (div) {
            displayNone(div);
        }
        console.log(this.preferences);
    }
    updateRouteSelections() {
        this.preferences.enableRoutes = new Set();
        $$('.route-option-checkbox:checked').forEach(checkbox => {
            if (!this.preferences.enableAgencies.has(checkbox.dataset.agency)) {
                return false;
            }
            this.preferences.enableRoutes.add(checkbox.value);
        });
        console.log(this.preferences);
    }
    toggleAllRoutes(agencyId) {
        console.log(`.route-option-checkbox[data-agency='${agencyId}']`);
        const checkboxes = $$(`.route-option-checkbox[data-agency='${agencyId}']`);
        const total = checkboxes.length;
        const checked = $$(`.route-option-checkbox[data-agency='${agencyId}']:checked`).length;
        checkboxes.forEach(checkbox => checkbox.checked = checked < total);
        this.updateRouteSelections();
        console.log(this.preferences);
    }
}