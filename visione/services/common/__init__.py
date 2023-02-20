import yaml


def load_config(yaml_path):
    # load config file
    with open(yaml_path, 'r') as yaml_file:
        config = yaml.safe_load(yaml_file)

    # fill default URL values
    def _fill_null(dictionary, fill_value):
        for k, v in dictionary.items():
            if v is None:
                dictionary[k] = fill_value

    _fill_null(config['static_files_urls'], 'http://router')
    _fill_null(config['services_urls'], 'http://router')

    return config