
import { Plugin } from 'obsidian';
import { GtdView, GTD_VIEW_TYPE, GTD_VIEW_DISPLAY_TEXT, GTD_VIEW_ICON } from './modules/moduloGTDv3/view.js';

export default class MyPlugin extends Plugin {
    override async onload() {
        console.log('Loading Dovela Personal Management Plugin...');

        // Register the GTD View
        this.registerView(
            GTD_VIEW_TYPE,
            (leaf) => new GtdView(leaf)
        );

        // Add a command to open the GTD View
        this.addCommand({
            id: 'open-gtd-dashboard',
            name: 'Open GTD Dashboard',
            callback: () => {
                this.activateView();
            }
        });

        // Add an icon to the left ribbon to open the GTD View
        this.addRibbonIcon(GTD_VIEW_ICON, GTD_VIEW_DISPLAY_TEXT, () => {
            this.activateView();
        });
    }

    override onunload() {
        console.log('Unloading Dovela Personal Management Plugin...');
        this.app.workspace.detachLeavesOfType(GTD_VIEW_TYPE);
    }

    private async activateView(): Promise<void> {
        // Ensure there's only one GTD view open at a time.
        this.app.workspace.detachLeavesOfType(GTD_VIEW_TYPE);

        // Open in a new tab in the current group
        const leaf = this.app.workspace.getLeaf('tab');

        await leaf.setViewState({
            type: GTD_VIEW_TYPE,
            active: true,
        });

        this.app.workspace.revealLeaf(leaf);
    }
}
