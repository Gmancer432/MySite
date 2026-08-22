const { ref, provide, inject } = Vue;

const TabContainer = {
    props: ['id', 'style'],
    data() {
        return {
            tabs: [],
        }
    },
    methods: {
        registerTab(tabData){
            this.tabs.push(tabData);
        }
    },
    provide() {
        return {
            registerTab: this.registerTab,
            activeTab: this.activeTab
        };
    },
    mounted(){
        const vm = this;
        this.$nextTick(() => {
            for(var t of vm.tabs){
                if(t.defaultActive){
                    var bsTab = new bootstrap.Tab('#'+t.id+'-tab');
                    bsTab.show();
                    break;
                }
            }
        });
    },
    template: `
    <div class="" :style="style">
        <ul :id="id" class="nav nav-tabs nav-fill" role="tablist">
            <li v-for="tab in tabs" v-show="!tab.hideTab" class="nav-item" role="presentation">
                <button class="nav-link" :id="tab.id+'-tab'" data-bs-toggle="tab" :data-bs-target="'#'+tab.id+'-tab-pane'" type="button" role="tab" :aria-controls="tab.id+'-tab-pane'" aria-selected="false">{{tab.name}}</button>
            </li>
        </ul>
        <div class="tab-content m-2" :id="id+'-content'">
            <slot />
        </div>
    </div>
    `
};


const Tab = {
    props: ['name', 'id', 'defaultActive', 'hideTab'],
    inject: [ 'registerTab', 'activeTab'],
    computed: {
        isActive(){
            return this.activeTab === this.id;
        }
    },
    mounted(){
      this.registerTab({ name: this.name, id: this.id, defaultActive: this.defaultActive === 'true', hideTab: this.hideTab === 'true' });
    },
    template: `
    <div class="tab-pane fade" :id="id+'-tab-pane'" role="tabpanel" :aria-labelledby="id+'-tab'" tabindex="0">
        <slot />    
    </div>
    `
};

export { TabContainer, Tab };