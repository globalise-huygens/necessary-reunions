FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

RUN apt update && apt install git wget build-essential ffmpeg libsm6 libxext6 -y

# Dependencies
RUN pip install mapreader && \
    pip install lxml && \
    pip install timm && \
    pip install 'git+https://github.com/facebookresearch/detectron2.git' && \
    pip install 'git+https://github.com/maps-as-data/MapTextPipeline.git'

RUN useradd -m mapreader
USER mapreader
WORKDIR /home/mapreader

# For the model config
RUN git clone https://github.com/maps-as-data/MapTextPipeline.git

# Models
RUN pip install -U "huggingface_hub[cli]" && \
    huggingface-cli download rwood-97/MapTextPipeline_rumsey rumsey-finetune.pth --local-dir .

# Copy the script
COPY ./spot_text.py /home/mapreader/spot_text.py