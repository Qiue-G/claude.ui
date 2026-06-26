<script>
  import { createEventDispatcher } from 'svelte';
  import Modal from '$components/common/Modal.svelte';
  import ModelList from './ModelList.svelte';
  import { savedModels, addModel, removeModel, switchModel } from '$stores/models.store.js';
  import { fetchModels } from '$apis/models.api.js';
  import { t } from '$lib/i18n.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  let activeTab = 'add';
  let formData = {
    name: '',
    provider: 'openrouter',
    model: '',
    apiKey: ''
  };
  let availableModels = [];
  let loadingModels = false;

  const providers = [
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'deepseek', label: 'DeepSeek' }
  ];

  $: if (open && activeTab === 'add') {
    loadAvailableModels();
  }

  async function loadAvailableModels() {
    loadingModels = true;
    try {
      const response = await fetchModels(formData.provider);
      availableModels = response.models || [];
    } catch (error) {
      console.error('Failed to load models:', error);
      availableModels = [];
    } finally {
      loadingModels = false;
    }
  }

  function handleProviderChange() {
    formData.model = '';
    loadAvailableModels();
  }

  function handleModelSelect(modelId) {
    formData.model = modelId;
  }

  async function handleAddModel() {
    if (!formData.name || !formData.model || !formData.apiKey) {
      return;
    }

    const model = addModel({
      name: formData.name,
      provider: formData.provider,
      model: formData.model,
      apiKey: formData.apiKey
    });

    // Auto-connect to the newly added model
    dispatch('connect', model);

    formData = { name: '', provider: 'openrouter', model: '', apiKey: '' };
    activeTab = 'manage';
  }

  function handleSwitchModel(e) {
    const model = e.detail;
    switchModel(model.id);
    dispatch('connect', model);
  }

  function handleDeleteModel(e) {
    const model = e.detail;
    if (confirm(`${$t('model.confirmDelete')} "${model.name}" ?`)) {
      removeModel(model.id);
    }
  }

  function handleEditModel(e) {
    const model = e.detail;
    formData = { ...model };
    activeTab = 'add';
  }

  function handleClose() {
    open = false;
    formData = { name: '', provider: 'openrouter', model: '', apiKey: '' };
    dispatch('close');
  }
</script>

<Modal {open} title={$t('model.configure')} on:close={handleClose}>
  <div class="config-modal">
    <div class="tabs">
      <button class="tab" class:active={activeTab === 'add'} on:click={() => activeTab = 'add'}>
        {$t('model.add')}
      </button>
      <button class="tab" class:active={activeTab === 'manage'} on:click={() => activeTab = 'manage'}>
        {$t('model.manage')}
      </button>
    </div>

    {#if activeTab === 'add'}
      <div class="tab-content">
        <form class="add-form" on:submit|preventDefault={handleAddModel}>
          <div class="form-group">
            <label for="name">{$t('model.name')}</label>
            <input id="name" type="text" bind:value={formData.name} placeholder={$t('model.namePlaceholder')} />
          </div>

          <div class="form-group">
            <label for="provider">{$t('model.provider')}</label>
            <select id="provider" bind:value={formData.provider} on:change={handleProviderChange}>
              {#each providers as p}
                <option value={p.value}>{p.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="model">{$t('model.model')}</label>
            {#if loadingModels}
              <div class="loading">{$t('common.loading')}...</div>
            {:else}
              <select id="model" bind:value={formData.model}>
                <option value="">{$t('model.selectModel')}</option>
                {#each availableModels as m}
                  <option value={m.id}>{m.id}</option>
                {/each}
              </select>
              <input type="text" bind:value={formData.model} placeholder={$t('model.modelPlaceholder')} class="model-input-manual" />
            {/if}
          </div>

          <div class="form-group">
            <label for="apiKey">{$t('model.apiKey')}</label>
            <input id="apiKey" type="password" bind:value={formData.apiKey} placeholder={$t('model.apiKeyPlaceholder')} />
          </div>

          <button type="submit" class="btn-primary" disabled={!formData.name || !formData.model || !formData.apiKey}>
            {$t('model.addModel')}
          </button>
        </form>
      </div>
    {:else}
      <div class="tab-content">
        <ModelList
          on:switch={handleSwitchModel}
          on:delete={handleDeleteModel}
          on:edit={handleEditModel}
        />
      </div>
    {/if}
  </div>
</Modal>

<style>
  .config-modal {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 420px;
    max-width: 100%;
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--text-primary);
    border-bottom-color: var(--amber);
  }

  .tab-content {
    padding: 0 8px;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-dim);
  }

  .form-group input,
  .form-group select {
    padding: 8px 10px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--amber);
  }

  .model-input-manual {
    margin-top: 6px;
  }

  .loading {
    padding: 8px;
    color: var(--text-dim);
    font-size: 12px;
  }

  .btn-primary {
    padding: 10px 16px;
    background: var(--amber-bg);
    color: var(--amber-bright);
    border: 1px solid var(--amber-border);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 4px;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--amber-hover);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>